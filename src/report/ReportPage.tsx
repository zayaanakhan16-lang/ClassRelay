import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessageSquarePlus,
  Quote,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { learningReport } from '@/services/ai';
import { createRoom } from '@/services/peer';
import { ErrorNote, InfoNote, ScoreRing, SectionHeading, SessionSteps, SourceTag, Spinner } from '@/components/ui';
import type { LearningReport, WeakConcept } from '@/types';
import { cn, wordCount } from '@/lib/utils';

/**
 * The learning report.
 *
 * It is private by design: nothing here is published or ranked. From here the student can
 * choose one weak concept and take it to a peer room — the only route by which anything
 * about this session ever reaches another person.
 */
export function ReportPage() {
  const navigate = useNavigate();
  const session = useSession();
  const { lesson, classroom, classQuiz, selfAnswers, report: storedReport, sharedConceptIds } = session;

  const [report, setReport] = useState<LearningReport | null>(storedReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareConcept, setShareConcept] = useState<WeakConcept | null>(null);

  useEffect(() => {
    if (!lesson) navigate('/start', { replace: true });
  }, [lesson, navigate]);

  const load = useCallback(async () => {
    if (!lesson) return;
    setLoading(true);
    setError(null);
    try {
      const result = await learningReport({
        lesson,
        presented: classroom.presented,
        history: classroom.history,
        classResult: classQuiz,
        selfResults: selfAnswers,
        misconceptions: classroom.misconceptions,
      });
      setReport(result);
      session.setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your report could not be written.');
    } finally {
      setLoading(false);
    }
  }, [lesson, classroom, classQuiz, selfAnswers, session]);

  useEffect(() => {
    if (!storedReport && !loading && !error && lesson) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedReport, lesson]);

  const deleteSession = useCallback(() => {
    session.reset();
    navigate('/', { replace: true });
  }, [session, navigate]);

  const incorrect = useMemo(
    () => selfAnswers.filter((a) => !a.correct).map((a) => a.id),
    [selfAnswers],
  );

  if (!lesson) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SessionSteps current="Report" className="mb-5" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            eyebrow="Learning report"
            title="What you taught well, and what to work on next"
            description="This report is private. It is not shared, ranked or published anywhere — only you can see it."
          />
          <div className="flex flex-col items-end gap-2">
            {report && <SourceTag source={report.source} />}
            <button type="button" className="btn-ghost btn-sm text-muted" onClick={deleteSession}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete session
            </button>
          </div>
        </div>

        {error && <ErrorNote className="mt-6" onRetry={() => void load()}>{error}</ErrorNote>}

        {loading && !report && (
          <div className="surface mt-8 flex flex-col items-center gap-3 p-10">
            <Spinner className="text-base" />
            <p className="display text-lg text-ink">Writing your report…</p>
            <p className="max-w-md text-center text-sm text-muted">
              Comparing what you said with your slides, your class results and your own quiz.
            </p>
          </div>
        )}

        {report && (
          <div className="mt-8 space-y-5">
            <div className="surface-ivory p-6">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-bold uppercase tracking-[0.16em] text-pencil-deep">Headline</p>
                  <p className="display mt-2 text-xl leading-snug text-ink-strong">{report.headline}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-2xs uppercase tracking-[0.1em] text-ink-strong/55">
                    <span>{classroom.presented.length} slides presented</span>
                    <span aria-hidden="true">·</span>
                    <span>{incorrect.length} quiz question{incorrect.length === 1 ? '' : 's'} missed</span>
                    <span aria-hidden="true">·</span>
                    <span>{classroom.misconceptions.filter((m) => !m.corrected).length} idea(s) still uncorrected</span>
                  </div>
                </div>
                {selfAnswers.length > 0 && (
                  <div className="shrink-0 rounded-2xl bg-paper/[0.04] p-3">
                    <ScoreRing
                      value={selfAnswers.filter((a) => a.correct).length}
                      max={selfAnswers.length}
                      label="Your quiz"
                      size="sm"
                      onLight
                    />
                  </div>
                )}
              </div>
            </div>

            {report.strengths.length > 0 && (
              <ReportSection title="What you did well" icon={Check} tone="moss">
                <ul className="space-y-2">
                  {report.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-right" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.wrong.length > 0 && (
              <ReportSection title="Explained incorrectly or read out loud" icon={TriangleAlert} tone="clay">
                <ul className="space-y-4">
                  {report.wrong.map((item, i) => (
                    <li key={`${item.slide}-${i}`} className="rounded-xl border border-line/10 bg-paper/40 p-4">
                      <p className="text-2xs uppercase tracking-[0.12em] text-wrong">Slide {item.slide}</p>
                      {item.youSaid && (
                        <p className="mt-2 flex items-start gap-2 text-sm italic leading-relaxed text-ink-soft">
                          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pencil-deep" aria-hidden="true" />
                          <span>
                            You said: &ldquo;{item.youSaid}&rdquo;
                            {item.quoteVerified && <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-right">verified</span>}
                          </span>
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        <span className="font-semibold text-ink">Better: </span>
                        {item.correct}
                      </p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.missed.length > 0 && (
              <ReportSection title="Not taught" icon={HelpCircle} tone="slate">
                <ul className="space-y-3">
                  {report.missed.map((item, i) => (
                    <li key={`${item.concept}-${i}`} className="rounded-xl border border-line/10 bg-paper/40 p-4">
                      <p className="text-sm font-semibold text-ink">
                        {item.concept} <span className="font-normal text-muted">· slide {item.slide}</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{item.why}</p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.misconceptions.length > 0 && (
              <ReportSection title="Ideas your class is still holding" icon={Lightbulb} tone="clay">
                <ul className="space-y-3">
                  {report.misconceptions.map((m, i) => (
                    <li key={`${m.belief}-${i}`} className="rounded-xl border border-line/10 bg-paper/40 p-4">
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{m.name}</span> believed &ldquo;{m.belief}&rdquo;.
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {m.corrected ? (
                          <span className="text-right">You corrected this in class. Good.</span>
                        ) : (
                          <>Say clearly why it is wrong: {m.correct}</>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.struggled.length > 0 && (
              <ReportSection title="Questions you left open" icon={MessageSquarePlus} tone="amber">
                <ul className="space-y-3">
                  {report.struggled.map((item, i) => (
                    <li key={`${item.question}-${i}`} className="rounded-xl border border-line/10 bg-paper/40 p-4">
                      <p className="text-sm font-medium text-ink">&ldquo;{item.question}&rdquo;</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{item.strongAnswer}</p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.why.length > 0 && (
              <ReportSection title="Where you knew the fact but not the reason" icon={Sparkles} tone="amber">
                <ul className="space-y-3">
                  {report.why.map((item, i) => (
                    <li key={`${item.question}-${i}`} className="rounded-xl border border-line/10 bg-paper/40 p-4">
                      <p className="text-sm font-medium text-ink">{item.question}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{item.strongAnswer}</p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.slideFixes.length > 0 && (
              <ReportSection title="Slides that need work" icon={BookOpenCheck} tone="slate">
                <ul className="space-y-2">
                  {report.slideFixes.map((item, i) => (
                    <li key={`${item.slide}-${i}`} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-surface/[0.08] px-2 text-2xs font-bold uppercase tracking-[0.1em] text-muted">
                        Slide {item.slide}
                      </span>
                      {item.fix}
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {report.nextSteps.length > 0 && (
              <ReportSection title="What to do next" icon={ListChecks} tone="moss">
                <ol className="space-y-2.5">
                  {report.nextSteps.map((step, i) => (
                    <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-right/20 text-2xs font-bold text-right">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </ReportSection>
            )}

            {/* PeerRelay entry point */}
            <div className="rounded-2xl border border-pencil/35 bg-pencil/[0.08] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">PeerRelay</p>
                  <h2 className="display mt-1.5 text-xl text-ink">Learn this with someone</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                    Pick one concept you found hard. ClassRelay creates a focused peer-learning card and opens a room where
                    other students can explain it their way. Nothing else from this session is shared — not your transcript,
                    not your score, not this report.
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 shrink-0 text-pencil-deep" aria-hidden="true" />
              </div>

              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {report.weakConcepts.map((concept) => {
                  const shared = sharedConceptIds.includes(concept.id);
                  return (
                    <li key={concept.id}>
                      <button
                        type="button"
                        onClick={() => setShareConcept(concept)}
                        disabled={shared}
                        className={cn(
                          'flex h-full w-full flex-col items-start gap-1.5 rounded-xl border px-4 py-3.5 text-left transition',
                          shared
                            ? 'border-right/40 bg-right/[0.1]'
                            : 'border-line/15 bg-paper/40 hover:border-pencil/50 hover:bg-paper/60',
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-ink">{concept.concept}</span>
                          {shared ? (
                            <span className="chip-moss">
                              <Check className="h-3 w-3" aria-hidden="true" />
                              Shared
                            </span>
                          ) : (
                            <Users className="h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
                          )}
                        </span>
                        <span className="text-xs leading-relaxed text-muted">{concept.detail}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button type="button" className="btn-ghost" onClick={() => navigate('/reteach')}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Re-teach a weak slide
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => navigate('/class-quiz')}>
                  Review the class quiz
                </button>
                <button type="button" className="btn-primary" onClick={() => navigate('/peers')}>
                  Go to PeerRelay
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {shareConcept && (
        <ShareConceptDialog
          concept={shareConcept}
          lessonTitle={lesson.title}
          onClose={() => setShareConcept(null)}
          onShared={(roomId) => {
            session.addSharedConcept(shareConcept.id);
            session.setSharedRoomId(roomId);
            setShareConcept(null);
            navigate(`/peers/${roomId}`);
          }}
        />
      )}
    </div>
  );
}

function ReportSection({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: typeof Check;
  tone: 'moss' | 'clay' | 'slate' | 'amber';
  children: React.ReactNode;
}) {
  const toneClass = {
    moss: 'text-right',
    clay: 'text-wrong',
    slate: 'text-mika',
    amber: 'text-pencil-deep',
  }[tone];
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      className="surface p-5 sm:p-6"
    >
      <h2 className={cn('display flex items-center gap-2 text-lg', toneClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

/**
 * The consent step. The student writes what is confusing in their own words and chooses
 * how much of their explanation to include. Nothing is pre-filled from the transcript.
 */
function ShareConceptDialog({
  concept,
  lessonTitle,
  onClose,
  onShared,
}: {
  concept: WeakConcept;
  lessonTitle: string;
  onClose: () => void;
  onShared: (roomId: string) => void;
}) {
  const [title, setTitle] = useState(concept.concept);
  const [detail, setDetail] = useState(concept.detail);
  const [question, setQuestion] = useState('');
  const [shareLevel, setShareLevel] = useState<WeakConcept['shareLevel']>('concept-only');
  const [excerpt, setExcerpt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (wordCount(detail) < 4) {
      setError('Describe what is confusing in at least a few words.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const room = await createRoom({
        title: title.trim() || concept.concept,
        concept: concept.concept,
        detail: detail.trim(),
        question: question.trim() || undefined,
        shareLevel,
        sharedExcerpt: shareLevel === 'concept-only' ? undefined : excerpt.trim() || undefined,
        subject: lessonTitle,
      });
      onShared(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The peer room could not be created.');
    } finally {
      setSubmitting(false);
    }
  }, [title, concept, detail, question, shareLevel, excerpt, lessonTitle, onShared]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-paper/85 px-4 py-10 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="surface-raised w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Share a concept</p>
            <h2 className="display mt-1 text-xl text-ink">Ask for help with this concept</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          You are choosing to share <strong className="text-ink">only this concept</strong>. Your transcript, quiz score
          and full report stay private. You can delete this room at any time.
        </p>

        {error && <ErrorNote className="mt-4">{error}</ErrorNote>}

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="share-title">Room title</label>
            <input id="share-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div>
            <label className="label" htmlFor="share-detail">What is confusing? (your words)</label>
            <textarea
              id="share-detail"
              className="field min-h-[6rem] resize-y leading-relaxed"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={800}
              rows={3}
            />
          </div>

          <div>
            <label className="label" htmlFor="share-question">Optional question for other students</label>
            <input
              id="share-question"
              className="field"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Can someone explain it without using the word 'reflect'?"
              maxLength={300}
            />
          </div>

          <fieldset>
            <legend className="label">How much of your own explanation do you want to include?</legend>
            <div className="mt-1 space-y-2">
              {(
                [
                  { value: 'concept-only', label: 'Concept only', hint: 'Just the concept and what is confusing. Nothing else.' },
                  { value: 'with-example', label: 'With an example', hint: 'Also share one sentence you wrote as an example.' },
                  { value: 'with-explanation', label: 'With my explanation', hint: 'Also share a short piece of how you explained it.' },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition',
                    shareLevel === option.value ? 'border-pencil/50 bg-pencil/[0.08]' : 'border-line/15 bg-paper/40 hover:border-line/28',
                  )}
                >
                  <input
                    type="radio"
                    name="share-level"
                    className="mt-1 h-4 w-4 accent-amber"
                    checked={shareLevel === option.value}
                    onChange={() => setShareLevel(option.value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {shareLevel !== 'concept-only' && (
            <div>
              <label className="label" htmlFor="share-excerpt">The part you are happy to share</label>
              <textarea
                id="share-excerpt"
                className="field min-h-[5rem] resize-y leading-relaxed"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Paste or write the short piece you want other students to see."
                maxLength={600}
                rows={3}
              />
            </div>
          )}
        </div>

        <InfoNote className="mt-5">
          Please keep this focused on the concept. Do not include anyone&rsquo;s personal details.
        </InfoNote>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Spinner label="Opening the room…" /> : (
              <>
                <Users className="h-4 w-4" aria-hidden="true" />
                Open the peer room
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
