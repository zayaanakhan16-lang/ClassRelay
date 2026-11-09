import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useClassroomMode } from './useClassroomMode';
import { useClassroom } from './useClassroom';
import { SlideStage } from './SlideStage';
import { ClassmateRow, SpeakingBubble } from './ClassmateRow';
import { TranscriptPanel } from './TranscriptPanel';
import { ErrorNote, InfoNote, ProgressRail, SectionHeading, SourceTag } from '@/components/ui';
import { CLASSMATES } from '@/data/classmates';
import { cn } from '@/lib/utils';

/**
 * Re-teach a weak slide.
 *
 * After the report, the student returns to the slides their class struggled with, with the
 * slide hidden. This closes the loop: the concept they could not explain, explained again
 * with what they learned from their peers.
 */
export function ReteachPage() {
  const navigate = useNavigate();
  const session = useSession();
  const { lesson, report } = session;
  const { setMode } = useClassroomMode();

  const weakSlides = useMemo(() => {
    if (!report) return [];
    const slides = new Set<number>();
    for (const item of report.missed) if (item.slide > 0) slides.add(item.slide);
    for (const item of report.wrong) slides.add(item.slide);
    for (const item of report.slideFixes) slides.add(item.slide);
    for (const item of report.struggled) if (item.slide > 0) slides.add(item.slide);
    for (const item of report.why) if (item.slide > 0) slides.add(item.slide);
    return [...slides].sort((a, b) => a - b).filter((n) => lesson?.slides.some((s) => s.n === n));
  }, [report, lesson]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const slideNumber = weakSlides[index] ?? 1;
  const slideIndex = slideNumber - 1;

  const classroomState = useClassroom({ slideIndex, fromMemory: true });
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
    busy,
    error,
    setError,
    readingNow,
    submitExplanation,
    submitAnswer,
    explained,
    lastSource,
  } = classroomState;

  // Re-teaching is always from memory: that is the point of coming back.
  useEffect(() => {
    setMode('memory');
  }, [setMode]);

  useEffect(() => {
    setRevealed(false);
  }, [index]);

  useEffect(() => {
    if (!lesson) navigate('/start', { replace: true });
  }, [lesson, navigate]);

  const next = useCallback(() => {
    if (index >= weakSlides.length - 1) {
      navigate('/report');
      return;
    }
    setIndex((i) => i + 1);
  }, [index, weakSlides.length, navigate]);

  if (!lesson) return null;

  if (!report || weakSlides.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="Re-teach"
            title="Nothing to re-teach yet"
            description="Finish a classroom session and review your learning report first. ClassRelay will pick the slides your class struggled with."
          />
          <button type="button" className="btn-primary mt-6" onClick={() => navigate(report ? '/report' : '/start')}>
            {report ? 'Back to my report' : 'Start a lesson'}
          </button>
        </div>
      </div>
    );
  }

  const speakingStudent = speaking?.student ?? null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            eyebrow="Re-teach"
            title={`Weak slide ${index + 1} of ${weakSlides.length}`}
            description="These are the slides your class struggled with. The slide is hidden — explain it from memory, with what you have learned since."
          />
          <span className="chip-amber">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            From memory
          </span>
        </div>

        <ProgressRail value={index + (explained ? 1 : 0)} max={weakSlides.length} className="mt-5" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <SlideStage slide={slide} fromMemory revealed={revealed} onReveal={setRevealed} />

            <div className="surface p-4 sm:p-5">
              <h2 className="display mb-3 text-base text-ink">Your classmates</h2>
              <ClassmateRow
                hands={hands}
                speaking={speaking}
                calledOn={calledOn}
                onCallOn={callOn}
                disabled={busy || !explained}
              />
            </div>

            {record.conversation.length > 0 && (
              <div className="surface p-4 sm:p-5">
                <h2 className="display mb-3 text-base text-ink">What the class asked this time</h2>
                <ol className="space-y-3">
                  {record.conversation.map((m) => {
                    const isYou = m.who === 'you';
                    const mate = isYou ? null : CLASSMATES[m.who as keyof typeof CLASSMATES];
                    return (
                      <li key={m.id} className={cn('rounded-xl border px-3.5 py-2.5', isYou ? 'border-right/30 bg-right/[0.08]' : 'border-line/10 bg-paper/45')}>
                        <p className="text-2xs font-bold uppercase tracking-[0.12em]" style={{ color: isYou ? '#4C7A62' : mate?.accentHex }}>
                          {isYou ? 'You' : mate?.name}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{m.text}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <InfoNote>
              <span className="font-semibold text-ink">Why this slide? </span>
              {report.wrong.some((w) => w.slide === slideNumber)
                ? 'You read it out loud rather than explaining it.'
                : report.missed.some((m) => m.slide === slideNumber)
                  ? 'An important idea on this slide was never explained.'
                  : 'This slide needs work.'}
            </InfoNote>

            <div className="surface p-5">
              {!explained ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="display text-base text-ink">Explain it again</h2>
                    {lastSource && <SourceTag source={lastSource} />}
                  </div>
                  <TranscriptPanel
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => void submitExplanation()}
                    busy={busy}
                    readingNow={readingNow}
                    submitLabel="Hand it to the class"
                    placeholder="Explain this slide from memory, the way you would now…"
                    helper="The slide is hidden. Saying its ideas from memory is exactly what counts here."
                  />
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="display text-base text-ink">Answer the class</h2>
                    {lastSource && <SourceTag source={lastSource} />}
                  </div>
                  {speaking && speakingStudent ? (
                    <SpeakingBubble student={speakingStudent} text={speaking.text} />
                  ) : (
                    <p className="rounded-xl border border-line/10 bg-paper/40 px-3.5 py-3 text-sm text-muted">
                      {hands.length ? 'Call on a classmate, or answer the room.' : 'No hands up — you can move on.'}
                    </p>
                  )}
                  {calledOn && (
                    <p className="mt-3 text-xs text-pencil-deep">
                      Answering {CLASSMATES[calledOn].name}{' '}
                      <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={clearCalledOn}>
                        (answer the whole room instead)
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
                      placeholder="Answer in your own words…"
                    />
                  </div>
                  <button type="button" className="btn-primary mt-4 w-full justify-center" onClick={next}>
                    {index >= weakSlides.length - 1 ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Finish re-teaching
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        Next weak slide
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            <button type="button" className="btn-ghost w-full justify-center" onClick={() => navigate('/report')}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Back to my report
            </button>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pencil-deep" aria-hidden="true" />
              Re-teaching does not change your earlier score. It is here so you can see the same idea land the second time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
