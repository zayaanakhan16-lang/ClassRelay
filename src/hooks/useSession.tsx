/**
 * The session store.
 *
 * One teaching session lives entirely in React state and is shared across routes by a
 * context provider. Nothing is persisted to localStorage: a lesson, its transcript and its
 * results disappear when the tab is closed, which is the honest default for a demo.
 *
 * The student can also delete the session outright from the classroom or the report.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  ClassQuizResult,
  ClassroomHistoryEntry,
  ClassroomMessage,
  ClassmateId,
  LearningReport,
  Lesson,
  Misconception,
  SelfAnswer,
  SelfQuiz,
} from '@/types';

export interface ClassroomState {
  history: ClassroomHistoryEntry[];
  /** Slides the student has presented, in order. */
  presented: number[];
  misconceptions: Misconception[];
  endedEarly: boolean;
}

export interface SessionState {
  lesson: Lesson | null;
  newToTopic: boolean;
  classroom: ClassroomState;
  classQuiz: ClassQuizResult | null;
  selfQuiz: SelfQuiz | null;
  selfAnswers: SelfAnswer[];
  report: LearningReport | null;
  /** The peer room this session's report was shared into, if any. */
  sharedRoomId: string | null;
  /** Concepts the student has already shared, so we do not create duplicates. */
  sharedConceptIds: string[];
}

const EMPTY: SessionState = {
  lesson: null,
  newToTopic: false,
  classroom: { history: [], presented: [], misconceptions: [], endedEarly: false },
  classQuiz: null,
  selfQuiz: null,
  selfAnswers: [],
  report: null,
  sharedRoomId: null,
  sharedConceptIds: [],
};

interface SessionContextValue extends SessionState {
  startLesson: (lesson: Lesson, newToTopic: boolean) => void;
  reset: () => void;
  setNewToTopic: (value: boolean) => void;
  recordSlide: (entry: ClassroomHistoryEntry) => void;
  markPresented: (n: number) => void;
  addMessage: (slide: number, message: ClassroomMessage) => void;
  setOpenQuestions: (slide: number, questions: { student: ClassmateId; text: string }[]) => void;
  setMisconceptions: (list: Misconception[]) => void;
  setEndedEarly: (value: boolean) => void;
  setClassQuiz: (result: ClassQuizResult | null) => void;
  setSelfQuiz: (quiz: SelfQuiz | null) => void;
  setSelfAnswers: (answers: SelfAnswer[]) => void;
  setReport: (report: LearningReport | null) => void;
  setSharedRoomId: (id: string | null) => void;
  addSharedConcept: (id: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(EMPTY);

  const startLesson = useCallback((lesson: Lesson, newToTopic: boolean) => {
    setState({ ...EMPTY, lesson, newToTopic });
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  const setNewToTopic = useCallback((newToTopic: boolean) => setState((s) => ({ ...s, newToTopic })), []);

  const recordSlide = useCallback(
    (entry: ClassroomHistoryEntry) =>
      setState((s) => {
        const history = s.classroom.history.filter((h) => h.n !== entry.n);
        history.push(entry);
        history.sort((a, b) => a.n - b.n);
        return { ...s, classroom: { ...s.classroom, history } };
      }),
    [],
  );

  const markPresented = useCallback(
    (n: number) =>
      setState((s) => ({
        ...s,
        classroom: {
          ...s.classroom,
          presented: s.classroom.presented.includes(n) ? s.classroom.presented : [...s.classroom.presented, n].sort((a, b) => a - b),
        },
      })),
    [],
  );

  const addMessage = useCallback(
    (slide: number, message: ClassroomMessage) =>
      setState((s) => ({
        ...s,
        classroom: {
          ...s.classroom,
          history: s.classroom.history.map((h) => (h.n === slide ? { ...h, conversation: [...h.conversation, message] } : h)),
        },
      })),
    [],
  );

  const setOpenQuestions = useCallback(
    (slide: number, questions: { student: ClassmateId; text: string }[]) =>
      setState((s) => ({
        ...s,
        classroom: {
          ...s.classroom,
          history: s.classroom.history.map((h) => (h.n === slide ? { ...h, openQuestions: questions } : h)),
        },
      })),
    [],
  );

  const setMisconceptions = useCallback(
    (list: Misconception[]) => setState((s) => ({ ...s, classroom: { ...s.classroom, misconceptions: list } })),
    [],
  );

  const setEndedEarly = useCallback(
    (value: boolean) => setState((s) => ({ ...s, classroom: { ...s.classroom, endedEarly: value } })),
    [],
  );

  const setClassQuiz = useCallback((classQuiz: ClassQuizResult | null) => setState((s) => ({ ...s, classQuiz })), []);
  const setSelfQuiz = useCallback((quiz: SelfQuiz | null) => setState((s) => ({ ...s, selfQuiz: quiz })), []);
  const setSelfAnswers = useCallback((selfAnswers: SelfAnswer[]) => setState((s) => ({ ...s, selfAnswers })), []);
  const setReport = useCallback((report: LearningReport | null) => setState((s) => ({ ...s, report })), []);
  const setSharedRoomId = useCallback((sharedRoomId: string | null) => setState((s) => ({ ...s, sharedRoomId })), []);

  const addSharedConcept = useCallback(
    (id: string) => setState((s) => ({ ...s, sharedConceptIds: s.sharedConceptIds.includes(id) ? s.sharedConceptIds : [...s.sharedConceptIds, id] })),
    [],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      startLesson,
      reset,
      setNewToTopic,
      recordSlide,
      markPresented,
      addMessage,
      setOpenQuestions,
      setMisconceptions,
      setEndedEarly,
      setClassQuiz,
      setSelfQuiz,
      setSelfAnswers,
      setReport,
      setSharedRoomId,
      addSharedConcept,
    }),
    [
      state,
      startLesson,
      reset,
      setNewToTopic,
      recordSlide,
      markPresented,
      addMessage,
      setOpenQuestions,
      setMisconceptions,
      setEndedEarly,
      setClassQuiz,
      setSelfQuiz,
      setSelfAnswers,
      setReport,
      setSharedRoomId,
      addSharedConcept,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider.');
  return ctx;
}
