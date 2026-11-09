import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Lightbulb, PenLine, SkipForward, Sparkles, X } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { judgeWhy, selfQuiz } from '@/services/ai';
import { ErrorNote, InfoNote, MicButton, ProgressRail, SectionHeading, SessionSteps, SourceTag, Spinner, ThinkingDots } from '@/components/ui';
import { useDictation } from '@/hooks/useDictation';
import type { SelfAnswer, SelfQuiz, QuizQuestion } from '@/types';
import { cn, wordCount } from '@/lib/utils';

/**
 * The student's own quiz.
 *
 * For every question they miss, they must first write why the correct answer is right
 * before the answer and explanation are revealed. That ordering is the point: it turns a
 * wrong answer into a reason to think.
 */
export function SelfQuizPage() {
  const navigate = useNavigate();
  const session = useSession();
  const { lesson, classroom, selfQuiz: storedQuiz, selfAnswers: storedAnswers } = session;

  const [quiz, setQuiz] = useState<SelfQuiz | null>(storedQuiz);
  const [answers, setAnswers] = useState<SelfAnswer[]>(storedAnswers);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [why, setWhy] = useState('');
  const [phase, setPhase] = useState<'answering' | 'reasoning' | 'revealed'>('answering');
  const [judging, setJudging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation();

  const presented = classroom.presented;

  useEffect(() => {
    if (!lesson) navigate('/start', { replace: true });
  }, [lesson, navigate]);

  const start = useCallback(async () => {
    if (!lesson) return;
    setLoading(true);
    setError(null);
    try {
      const result = storedQuiz ?? (await selfQuiz({ lesson, presented }));
      setQuiz(result);
      session.setSelfQuiz(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your quiz could not be written.');
    } finally {
      setLoading(false);
    }
  }, [lesson, presented, storedQuiz, session]);

  const question: QuizQuestion | undefined = quiz?.questions[index];
  const correctIndex = question?.answer ?? 0;

  const finish = useCallback(
    (final: SelfAnswer[]) => {
      session.setSelfAnswers(final);
      navigate('/report');
    },
    [session, navigate],
  );

  const submitAnswer = useCallback(() => {
    if (selected === null || !question) return;
    if (selected === correctIndex) {
      const entry: SelfAnswer = { id: question.id, choice: selected, why: '', correct: true, whyVerdict: 'unjudged' };
      const next = [...answers.filter((a) => a.id !== question.id), entry];
      setAnswers(next);
      setPhase('revealed');
    } else {
      setPhase('reasoning');
    }
  }, [selected, question, correctIndex, answers]);

  const submitReasoning = useCallback(async () => {
    if (!question || wordCount(why) < 3) return;
    setJudging(true);
    setError(null);
    try {
      const verdict = await judgeWhy({
        question: question.question,
        options: question.options,
        answer: correctIndex,
        explanation: question.explanation ?? '',
        why,
      });
      const entry: SelfAnswer = {
        id: question.id,
        choice: selected,
        why,
        correct: false,
        whyVerdict: verdict.verdict,
        whyFeedback: verdict.feedback,
      };
      setAnswers((prev) => [...prev.filter((a) => a.id !== question.id), entry]);
      setPhase('revealed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your reasoning could not be read. Try again.');
    } finally {
      setJudging(false);
    }
  }, [question, why, correctIndex, selected]);

  const next = useCallback(() => {
    if (!quiz) return;
    const isLast = index >= quiz.questions.length - 1;
    if (isLast) {
      finish(answers);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setWhy('');
    setPhase('answering');
  }, [quiz, index, answers, finish]);

  const skipQuiz = useCallback(() => {
    session.setSelfAnswers([]);
    navigate('/report');
  }, [session, navigate]);

  const score = useMemo(() => answers.filter((a) => a.correct).length, [answers]);

  if (!lesson) return null;

  if (!quiz) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <SessionSteps current="Your quiz" className="mb-5" />
          <SectionHeading
            eyebrow="Your quiz"
            title="Check what you really understand"
            description="These questions come from your lesson and your explanation. You will only see the answers after you have tried."
          />
          {error && <ErrorNote className="mt-6" onRetry={() => void start()}>{error}</ErrorNote>}
          <div className="surface mt-8 p-6">
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
                For each question you miss, you first write why the correct answer is right. Only then is it revealed.
              </li>
              <li className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
                Your reasoning is read by an AI tutor, which tells you what to add. You can skip the quiz entirely.
              </li>
            </ul>
            <button type="button" className="btn-primary mt-6" onClick={() => void start()} disabled={loading}>
              {loading ? <Spinner label="Writing your quiz…" /> : 'Begin my quiz'}
            </button>
            <button type="button" className="btn-ghost mt-3 w-full justify-center" onClick={skipQuiz}>
              Skip to my learning report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <SessionSteps current="Your quiz" className="mb-5" />
        <div className="flex items-center justify-between gap-3">
          <SectionHeading eyebrow="Your quiz" title={`Question ${index + 1} of ${quiz.questions.length}`} />
          <SourceTag source={quiz.source} />
        </div>

        <ProgressRail value={index + (phase === 'revealed' ? 1 : 0)} max={quiz.questions.length} className="mt-5" />

        {question && (
          <motion.div key={question.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="surface mt-6 p-6">
            <p className="text-2xs uppercase tracking-[0.12em] text-muted">Slide {question.slide} · {question.concept}</p>
            <h2 className="display mt-2 text-xl leading-snug text-ink">{question.question}</h2>

            <ul className="mt-5 space-y-2.5">
              {question.options.map((option, i) => {
                const isSelected = selected === i;
                const isCorrect = phase === 'revealed' && i === correctIndex;
                const isWrongPick = phase === 'revealed' && isSelected && i !== correctIndex;
                return (
                  <li key={option}>
                    <button
                      type="button"
                      disabled={phase !== 'answering'}
                      onClick={() => setSelected(i)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition',
                        isCorrect
                          ? 'border-right/60 bg-right/12 text-ink'
                          : isWrongPick
                            ? 'border-wrong/55 bg-wrong/12 text-ink'
                            : isSelected
                              ? 'border-pencil/60 bg-pencil/[0.1] text-ink'
                              : 'border-line/12 bg-paper/40 text-ink-soft hover:border-line/28',
                        phase !== 'answering' && 'cursor-default',
                      )}
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-2xs font-bold">
                        {isCorrect ? <Check className="h-3 w-3" aria-hidden="true" /> : isWrongPick ? <X className="h-3 w-3" aria-hidden="true" /> : String.fromCharCode(65 + i)}
                      </span>
                      <span className="leading-relaxed">{option}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {error && <ErrorNote className="mt-4" onRetry={() => setError(null)}>{error}</ErrorNote>}

            {phase === 'answering' && (
              <button type="button" className="btn-primary mt-5 w-full justify-center" disabled={selected === null} onClick={submitAnswer}>
                Submit answer
              </button>
            )}

            {phase === 'reasoning' && (
              <div className="mt-5 rounded-2xl border border-pencil/35 bg-pencil/[0.07] p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-pencil-deep">
                  <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                  Before you see the answer
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  You missed this one. Write one sentence: why is the correct answer right?
                </p>
                <label className="sr-only" htmlFor="why-input">
                  Why is the correct answer right?
                </label>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <MicButton
                    supported={dictation.supported}
                    listening={dictation.listening}
                    level={dictation.level}
                    onClick={() => dictation.toggle(why, setWhy)}
                  />
                  {!dictation.supported && <span className="text-2xs text-muted">Voice is unavailable here — type instead</span>}
                </div>
                {dictation.error && <ErrorNote className="mt-2">{dictation.error}</ErrorNote>}
                <textarea
                  id="why-input"
                  className="field mt-3 min-h-[6rem] resize-y leading-relaxed"
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="The correct answer is right because…"
                  rows={3}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  {judging ? <ThinkingDots label="Reading your reasoning…" /> : <span className="text-xs text-muted">{wordCount(why)} words</span>}
                  <button type="button" className="btn-primary btn-sm" onClick={() => void submitReasoning()} disabled={wordCount(why) < 3 || judging}>
                    Reveal the answer
                  </button>
                </div>
              </div>
            )}

            {phase === 'revealed' && (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-right/40 bg-right/[0.09] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-right">The correct answer</p>
                  <p className="mt-1.5 text-sm font-medium text-ink">{question.options[correctIndex]}</p>
                  {question.explanation && <p className="mt-2 text-sm leading-relaxed text-muted">{question.explanation}</p>}
                </div>

                {answers.find((a) => a.id === question.id)?.whyFeedback && (
                  <InfoNote>
                    <span className="font-semibold text-ink">On your reasoning: </span>
                    {answers.find((a) => a.id === question.id)?.whyFeedback}
                    {(() => {
                      const verdict = answers.find((a) => a.id === question.id)?.whyVerdict;
                      if (!verdict || verdict === 'unjudged') return null;
                      return <span className="ml-1 text-xs uppercase tracking-[0.1em] text-pencil-deep">({verdict})</span>;
                    })()}
                  </InfoNote>
                )}

                <button type="button" className="btn-primary w-full justify-center" onClick={next}>
                  {index >= quiz.questions.length - 1 ? 'See my learning report' : 'Next question'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-muted">
          <span>
            {score} correct so far
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={skipQuiz}>
            <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            Skip to report
          </button>
        </div>
      </div>
    </div>
  );
}
