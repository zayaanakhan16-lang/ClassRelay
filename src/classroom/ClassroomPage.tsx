import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  CornerDownRight,
  Eye,
  EyeOff,
  Flag,
  Hand,
  LogOut,
  SkipForward,
  Trash2,
  Users,
} from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useClassroomMode } from './useClassroomMode';
import { useClassroom } from './useClassroom';
import { useVoices } from '@/hooks/useVoices';
import { SlideStage } from './SlideStage';
import { ClassmateRow, SpeakingBubble } from './ClassmateRow';
import { StudyCardPanel, TranscriptPanel } from './TranscriptPanel';
import { SourceTag, ErrorNote, ProgressRail, SessionSteps, VoiceToggle, DifficultyChip } from '@/components/ui';
import { CLASSMATES } from '@/data/classmates';
import type { ClassroomMessage, Difficulty } from '@/types';
import { cn } from '@/lib/utils';

/**
 * The virtual classroom.
 *
 * One slide at a time: explain it, answer the raised hands, then move on. The class quiz
 * and the report only ever cover the slides presented here.
 */
export function ClassroomPage() {
  const navigate = useNavigate();
  const session = useSession();
  const { lesson, classroom, newToTopic } = session;
  const { mode, setMode } = useClassroomMode();

  const [slideIndex, setSlideIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [studyOpen, setStudyOpen] = useState(newToTopic);
  const [studyRequested, setStudyRequested] = useState(newToTopic);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const fromMemory = mode === 'memory' || studyOpen;

  const classroomState = useClassroom({ slideIndex, fromMemory });
  const {
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
    clearCalledOn,
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
    explained,
    lastSource,
  } = classroomState;

  useEffect(() => {
    if (!lesson) navigate('/start', { replace: true });
  }, [lesson, navigate]);

  useEffect(() => {
    setRevealed(false);
  }, [slideIndex]);

  useEffect(() => {
    if (studyRequested && !studyCard && !studyLoading && !studyError) void requestStudyCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyRequested, slideIndex]);

  const totalSlides = lesson?.slides.length ?? 0;
  const isLast = slideIndex >= totalSlides - 1;
  const canAdvance = explained && (hands.length === 0 || record.openQuestions.length === 0 || round >= 2);
  const presentedCount = classroom.presented.length;

  const nextSlide = useCallback(() => {
    if (isLast) {
      navigate('/class-quiz');
      return;
    }
    setSlideIndex((i) => Math.min(totalSlides - 1, i + 1));
  }, [isLast, navigate, totalSlides]);

  const skipSlide = useCallback(() => {
    if (isLast) {
      navigate('/class-quiz');
      return;
    }
    setSlideIndex((i) => Math.min(totalSlides - 1, i + 1));
  }, [isLast, navigate, totalSlides]);

  const endClass = useCallback(() => {
    session.setEndedEarly(true);
    navigate('/class-quiz');
  }, [session, navigate]);

  const deleteSession = useCallback(() => {
    session.reset();
    navigate('/', { replace: true });
  }, [session, navigate]);

  const speakingStudent = speaking?.student ?? null;
  const moods = useMemo(() => {
    const map: Record<string, 'confused' | 'skeptical' | 'curious' | 'connecting' | 'neutral' | 'satisfied'> = {};
    for (const h of hands) map[h.student] = h.mood;
    return map;
  }, [hands]);

  // Spoken classmates: each question is read aloud in that classmate's own voice.
  const voices = useVoices();
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!speaking) {
      spokenRef.current = null;
      return;
    }
    const key = `${speaking.student}:${speaking.text}`;
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    voices.say(speaking.student, speaking.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking]);

  if (!lesson) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-7">
        {/* Top bar: progress, mode, exit */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="chip-amber">Slide {slideIndex + 1} of {totalSlides}</span>
            <span className="hidden text-sm text-muted sm:inline">{lesson.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-line/15 bg-paper/50 p-0.5" role="group" aria-label="Presentation mode">
              <button
                type="button"
                onClick={() => setMode('slides')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.1em] transition',
                  mode === 'slides' ? 'bg-surface/[0.12] text-ink' : 'text-muted hover:text-ink-soft',
                )}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                With slides
              </button>
              <button
                type="button"
                onClick={() => setMode('memory')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.1em] transition',
                  mode === 'memory' ? 'bg-surface/[0.12] text-ink' : 'text-muted hover:text-ink-soft',
                )}
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                From memory
              </button>
            </div>
            <VoiceToggle supported={voices.supported} enabled={voices.enabled} onChange={voices.setEnabled} />
            <button type="button" className="btn-ghost btn-sm" onClick={deleteSession} title="Delete this session">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Delete session</span>
            </button>
          </div>
        </div>

        <ProgressRail value={slideIndex + (explained ? 1 : 0)} max={totalSlides} className="mt-4" />
        <SessionSteps current="Teach" className="mt-4" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* Left column: the stage and the class */}
          <div className="space-y-5">
            <SlideStage
              slide={slide}
              fromMemory={fromMemory}
              revealed={revealed}
              onReveal={setRevealed}
            />

            <div className="surface p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="display flex items-center gap-2 text-base text-ink">
                  <Users className="h-4 w-4 text-pencil-deep" aria-hidden="true" />
                  Your classmates
                </h2>
                {hands.length > 0 && (
                  <span className="chip-amber">
                    <Hand className="h-3 w-3" aria-hidden="true" />
                    {hands.length} hand{hands.length === 1 ? '' : 's'} up
                  </span>
                )}
              </div>
              <ClassmateRow
                hands={hands}
                speaking={speaking}
                calledOn={calledOn}
                onCallOn={callOn}
                disabled={busy || !explained}
                moods={moods}
              />
              {!explained && (
                <p className="mt-3 text-xs text-muted">Explain the slide first — the classmates raise their hands once they have heard you.</p>
              )}
            </div>

            {/* Classroom conversation */}
            <div className="surface p-4 sm:p-5">
              <h2 className="display mb-3 text-base text-ink">Classroom conversation</h2>
              <ConversationLog record={record} />
            </div>
          </div>

          {/* Right column: input */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            {!explained ? (
              <div className="surface p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="display text-base text-ink">Explain this slide</h2>
                  {lastSource && <SourceTag source={lastSource} />}
                </div>
                <TranscriptPanel
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => void submitExplanation()}
                  busy={busy}
                  readingNow={readingNow}
                  submitLabel="Hand it to the class"
                  placeholder={
                    fromMemory
                      ? 'Explain this slide from memory, in your own words…'
                      : 'Explain this slide in your own words, as if your classmates have never seen it…'
                  }
                  helper="Your classmates remember everything you say here. They will ask about the parts you leave out."
                  studySlot={
                    <StudyCardPanel
                      card={studyCard}
                      loading={studyLoading}
                      error={studyError}
                      requested={studyRequested}
                      onRequest={() => {
                        setStudyRequested(true);
                        void requestStudyCard();
                      }}
                      onClose={() => {
                        setStudyOpen(false);
                        setStudyRequested(false);
                      }}
                    />
                  }
                />
              </div>
            ) : (
              <div className="surface p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="display text-base text-ink">Answer the class</h2>
                  {lastSource && <SourceTag source={lastSource} />}
                </div>

                {speaking && speakingStudent ? (
                  <SpeakingBubble
                    student={speakingStudent}
                    text={speaking.text}
                    difficulty={speaking.difficulty}
                    speaking={voices.voiceSpeaking === speakingStudent}
                    canReplay={voices.enabled}
                    onReplay={() => voices.say(speakingStudent, speaking.text)}
                  />
                ) : (
                  <p className="rounded-xl border border-line/10 bg-paper/40 px-3.5 py-3 text-sm text-muted">
                    {hands.length
                      ? 'Call on a classmate, or answer the whole room.'
                      : 'No hands up. You can keep explaining, or move to the next slide.'}
                  </p>
                )}

                {calledOn && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-pencil-deep">
                    <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    Answering {CLASSMATES[calledOn].name}
                    <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={clearCalledOn}>
                      answer the whole room instead
                    </button>
                  </p>
                )}

                {error && <ErrorNote className="mt-3" onRetry={() => setError(null)}>{error}</ErrorNote>}

                <div className="mt-3">
                  <TranscriptPanel
                    value={answer}
                    onChange={setAnswer}
                    onSubmit={() => void submitAnswer()}
                    busy={busy}
                    submitLabel={calledOn ? `Answer ${CLASSMATES[calledOn].name}` : 'Answer the room'}
                    placeholder="Answer the question in your own words…"
                    helper="Your answer goes to the whole class — everyone remembers it."
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-line/10 pt-4">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={nextSlide}
                    disabled={!canAdvance && !isLast}
                    title={
                      canAdvance || isLast
                        ? undefined
                        : hands.length
                          ? 'Answer the raised question first — or use “Skip this slide” to move on.'
                          : 'Explain this slide before moving on — or use “Skip this slide”.'
                    }
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    {isLast ? 'Finish and take the class quiz' : 'Next slide'}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={skipSlide}>
                    <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                    Skip this slide
                  </button>
                  <button type="button" className="btn-ghost btn-sm ml-auto text-muted" onClick={() => setConfirmEnd(true)}>
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                    End class early
                  </button>
                </div>
              </div>
            )}

            <div className="surface p-4">
              <h3 className="display text-sm text-ink">Session progress</h3>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                <Stat label="Slides presented" value={presentedCount} />
                <Stat label="Questions asked" value={record.conversation.filter((m) => m.kind === 'question').length} />
                <Stat label="Hands waiting" value={hands.length} />
              </dl>
            </div>
          </div>
        </div>
      </div>

      {confirmEnd && (
        <ConfirmEndDialog
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            endClass();
          }}
          presented={presentedCount}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line/10 bg-paper/40 px-2 py-2.5">
      <dt className="text-2xs uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className="display mt-1 text-xl text-ink">{value}</dd>
    </div>
  );
}

/** The running conversation for this slide: the explanation, questions and answers. */
function ConversationLog({ record }: { record: { said: string; conversation: ClassroomMessage[] } }) {
  const items: { key: string; who: string; text: string; kind: string; difficulty?: Difficulty }[] = [];
  if (record.said) items.push({ key: 'said', who: 'you', text: record.said, kind: 'statement' });
  for (const m of record.conversation) items.push({ key: m.id, who: m.who, text: m.text, kind: m.kind, difficulty: m.difficulty });

  if (!items.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-line/15 px-3.5 py-6 text-sm text-muted">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        Your explanation and the class discussion will appear here.
      </p>
    );
  }

  return (
    <ol className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
      {items.map((item) => {
        const isYou = item.who === 'you';
        const mate = isYou ? null : CLASSMATES[item.who as keyof typeof CLASSMATES];
        return (
          <li key={item.key} className={cn('flex flex-col gap-1 rounded-xl border px-3.5 py-2.5', isYou ? 'border-right/30 bg-right/[0.08]' : 'border-line/10 bg-paper/45')}>
            <span className="flex items-center gap-2 text-2xs font-bold uppercase tracking-[0.12em]" style={{ color: isYou ? '#4C7A62' : mate?.accentHex }}>
              {isYou ? (
                <>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  You
                </>
              ) : (
                mate?.name
              )}
              {item.kind === 'question' && (
                <>
                  <span className="text-muted">· question</span>
                  <DifficultyChip difficulty={item.difficulty} />
                </>
              )}
              {item.kind === 'answer' && <span className="text-muted">· your answer</span>}
            </span>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{item.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ConfirmEndDialog({ onCancel, onConfirm, presented }: { onCancel: () => void; onConfirm: () => void; presented: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="surface-raised w-full max-w-md p-6">
        <h2 className="display text-lg text-ink">End the class early?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The class quiz and your learning report will only cover the {presented} slide{presented === 1 ? '' : 's'} you presented.
          Slides you have not reached are not graded.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Keep teaching
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            End and take the quiz
          </button>
        </div>
      </div>
    </div>
  );
}
