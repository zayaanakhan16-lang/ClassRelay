import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ClassTurnResult,
  ClassroomHistoryEntry,
  ClassroomMessage,
  ClassmateId,
  Difficulty,
  Misconception,
  RaisedHand,
  SlideRecord,
  StudyCard,
} from '@/types';
import { classTurn as callClassTurn, studyCard as callStudyCard } from '@/services/ai';
import { useSession } from '@/hooks/useSession';
import { looksReadAloud } from '@/lib/readAloud';
import { uid, wordCount } from '@/lib/utils';

export const MAX_ROUNDS = 6;
const MIN_EXPLAIN_WORDS = 8;

export interface HandState extends RaisedHand {
  /** Set once the classmate has been called on and has spoken. */
  spoken?: boolean;
}

interface UseClassroomArgs {
  slideIndex: number;
  fromMemory: boolean;
}

/**
 * Owns everything that happens inside one slide's classroom conversation:
 * the explanation, the raised hands, the answers, and the class turn requests.
 */
export function useClassroom({ slideIndex, fromMemory }: UseClassroomArgs) {
  const session = useSession();
  const { lesson, classroom } = session;

  const slide = lesson?.slides.find((s) => s.n === slideIndex + 1) ?? null;
  const record: SlideRecord = useMemo(
    () =>
      classroom.history.find((h) => h.n === slideIndex + 1) ?? {
        n: slideIndex + 1,
        said: '',
        fromMemory: false,
        readAloud: false,
        conversation: [],
        openQuestions: [],
      },
    [classroom.history, slideIndex],
  );

  const [draft, setDraft] = useState('');
  const [answer, setAnswer] = useState('');
  const [hands, setHands] = useState<HandState[]>([]);
  const [speaking, setSpeaking] = useState<{ student: ClassmateId; text: string; difficulty?: Difficulty } | null>(null);
  const [calledOn, setCalledOn] = useState<ClassmateId | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyCard, setStudyCard] = useState<StudyCard | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<'ai' | 'demo' | null>(null);

  // Reset the local conversation when the student moves to another slide.
  useEffect(() => {
    setDraft('');
    setAnswer('');
    setHands([]);
    setSpeaking(null);
    setCalledOn(null);
    setRound(0);
    setError(null);
    setStudyCard(null);
    setStudyError(null);
  }, [slideIndex]);

  const allSlideText = useMemo(() => lesson?.slides.map((s) => s.text).join(' \n ') ?? '', [lesson]);

  /** Live warning while the student is still typing: are they reading the slide? */
  const readingNow = useMemo(() => {
    if (fromMemory || !slide) return false;
    return looksReadAloud(draft, slide.text, allSlideText) && wordCount(draft) >= MIN_EXPLAIN_WORDS;
  }, [draft, slide, fromMemory, allSlideText]);

  const held = useMemo(
    () =>
      classroom.misconceptions.map((m, i) => ({ id: `B${i + 1}`, student: m.student, belief: m.belief, slide: m.slide })),
    [classroom.misconceptions],
  );

  const askedQuestions = useMemo(
    () => classroom.history.flatMap((h) => h.conversation.filter((m) => m.kind === 'question').map((m) => m.text)),
    [classroom.history],
  );

  /** Applies a class-turn result: update the speaker, hands, and any misconception. */
  const applyTurn = useCallback(
    (result: ClassTurnResult, base: SlideRecord) => {
      setLastSource(result.source);
      const newHands: HandState[] = result.hands.map((h) => ({ ...h }));
      const conversation = [...base.conversation];

      if (result.speaker && result.line) {
        const message: ClassroomMessage = {
          id: uid('m'),
          who: result.speaker,
          text: result.line,
          kind: 'question',
          slide: slideIndex + 1,
          at: Date.now(),
          mood: newHands.find((h) => h.student === result.speaker)?.mood ?? result.speakerMood ?? 'neutral',
          difficulty: result.difficulty ?? 'core',
        };
        conversation.push(message);
        setSpeaking({ student: result.speaker, text: result.line, difficulty: result.difficulty ?? 'core' });
        // The speaker keeps their hand up until the student answers them.
        if (!newHands.some((h) => h.student === result.speaker)) {
          newHands.unshift({
            student: result.speaker,
            question: result.line,
            mood: message.mood ?? 'neutral',
            reason: 'Waiting for your answer.',
            difficulty: result.difficulty ?? 'core',
          });
        }
      } else {
        setSpeaking(null);
      }
      setHands(newHands);

      const open = newHands.map((h) => ({ student: h.student, text: h.question }));

      let misconceptions = classroom.misconceptions;
      if (result.misconception) {
        const exists = misconceptions.some((m) => m.belief === result.misconception?.belief);
        if (!exists) {
          misconceptions = [
            ...misconceptions,
            { student: result.misconception.student, belief: result.misconception.belief, slide: slideIndex + 1, corrected: false },
          ];
          session.setMisconceptions(misconceptions);
        }
      }
      if (result.corrected && result.corrected.length) {
        misconceptions = misconceptions.map((m) =>
          result.corrected?.includes(m.belief) ? { ...m, corrected: true, correctedOn: slideIndex + 1 } : m,
        );
        session.setMisconceptions(misconceptions);
      }

      const updated: ClassroomHistoryEntry = {
        ...base,
        conversation,
        openQuestions: open,
        misconceptions: misconceptions.filter((m) => m.slide === slideIndex + 1),
      };
      session.recordSlide(updated);
      return updated;
    },
    [classroom.misconceptions, session, slideIndex],
  );

  /** Sends the explanation for this slide and lets the class react. */
  const submitExplanation = useCallback(async () => {
    if (!lesson || !slide || busy) return;
    const said = draft.trim();
    if (wordCount(said) < 3) {
      setError('Say a little more before handing it to the class — a few sentences at least.');
      return;
    }
    setBusy(true);
    setError(null);

    const readAloud = !fromMemory && looksReadAloud(said, slide.text, allSlideText);
    const base: ClassroomHistoryEntry = {
      ...record,
      said,
      fromMemory,
      readAloud,
      misconceptions: classroom.misconceptions.filter((m) => m.slide === slideIndex + 1),
    };
    session.recordSlide(base);
    session.markPresented(slideIndex + 1);

    try {
      const result = await callClassTurn({
        lesson,
        slideIndex,
        slideText: slide.text,
        said,
        round: 0,
        calledOn: null,
        open: [],
        held,
        history: classroom.history.filter((h) => h.n !== slideIndex + 1),
        recalled: fromMemory,
        askedQuestions,
      });
      applyTurn(result, base);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The class could not respond. Try again.');
    } finally {
      setBusy(false);
    }
  }, [lesson, slide, busy, draft, fromMemory, allSlideText, record, classroom.misconceptions, classroom.history, session, slideIndex, held, askedQuestions, applyTurn]);

  /** Sends an answer to the room, or to the classmate the student called on. */
  const submitAnswer = useCallback(async () => {
    if (!lesson || !slide || busy) return;
    const text = answer.trim();
    if (wordCount(text) < 2) {
      setError('Type or say your answer first.');
      return;
    }
    setBusy(true);
    setError(null);

    const target = calledOn ?? hands[0]?.student ?? null;
    const answerMessage: ClassroomMessage = {
      id: uid('m'),
      who: 'you',
      text,
      kind: 'answer',
      slide: slideIndex + 1,
      at: Date.now(),
    };
    const base: ClassroomHistoryEntry = {
      ...record,
      conversation: [...record.conversation, answerMessage],
      misconceptions: classroom.misconceptions.filter((m) => m.slide === slideIndex + 1),
    };
    session.recordSlide(base);

    const nextRound = Math.min(MAX_ROUNDS, round + 1);
    setRound(nextRound);
    setAnswer('');
    setSpeaking(null);

    try {
      const result = await callClassTurn({
        lesson,
        slideIndex,
        slideText: slide.text,
        said: record.said,
        round: nextRound,
        calledOn: target,
        answer: text,
        open: hands.map((h) => ({ student: h.student, text: h.question })),
        held,
        history: classroom.history.filter((h) => h.n !== slideIndex + 1),
        conversation: base.conversation,
        recalled: fromMemory,
        askedQuestions,
      });
      applyTurn(result, base);
      if (target) setCalledOn(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The class could not respond. Try again.');
    } finally {
      setBusy(false);
    }
  }, [lesson, slide, busy, answer, calledOn, hands, round, record, classroom.misconceptions, classroom.history, session, slideIndex, held, askedQuestions, fromMemory, applyTurn]);

  const callOn = useCallback((student: ClassmateId) => {
    setCalledOn(student);
    setAnswer('');
    setError(null);
  }, []);

  const requestStudyCard = useCallback(async () => {
    if (!lesson || !slide || studyLoading) return;
    setStudyLoading(true);
    setStudyError(null);
    try {
      const card = await callStudyCard({ lesson, slideIndex, slideText: slide.text });
      setStudyCard(card);
    } catch (err) {
      setStudyError(err instanceof Error ? err.message : 'The study card could not be written.');
    } finally {
      setStudyLoading(false);
    }
  }, [lesson, slide, slideIndex, studyLoading]);

  const openQuestions = useMemo(
    () => hands.filter((h) => !h.spoken).map((h) => ({ student: h.student, text: h.question })),
    [hands],
  );

  return {
    slide,
    record,
    draft,
    setDraft,
    answer,
    setAnswer,
    hands,
    speaking,
    calledOn,
    callOn,
    clearCalledOn: () => setCalledOn(null),
    round,
    busy,
    error,
    setError,
    readingNow,
    studyCard,
    studyLoading,
    studyError,
    requestStudyCard,
    submitExplanation,
    submitAnswer,
    lastSource,
    openQuestions,
    explained: Boolean(record.said),
    hasAnswered: record.conversation.some((m) => m.who === 'you'),
  };
}

export type { Misconception };
