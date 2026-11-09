import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileText, Quote, ShieldQuestion, Users, XCircle } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { classQuiz, gradeClassQuiz } from '@/services/ai';
import { ClassmateAvatar } from '@/components/ClassmateAvatar';
import { ErrorNote, InfoNote, ProgressRail, ScoreRing, SectionHeading, SessionSteps, SourceTag, Spinner } from '@/components/ui';
import { CLASSMATES, CLASSMATE_IDS } from '@/data/classmates';
import type { AnswerSource, ClassAnswer, ClassQuizResult, QuizQuestion } from '@/types';
import { cn } from '@/lib/utils';

/**
 * The class quiz.
 *
 * Four classmates answer a quiz written from the slides, using only the words the student
 * actually said. Every answer shows the quote it rests on and the reason it was accepted
 * or rejected, so the score is never a black box.
 */
export function ClassQuizPage() {
  const navigate = useNavigate();
  const session = useSession();
  const { lesson, classroom, classQuiz: stored } = session;

  const [result, setResult] = useState<ClassQuizResult | null>(stored);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'intro' | 'running' | 'done'>(stored ? 'done' : 'intro');

  useEffect(() => {
    if (!lesson) navigate('/start', { replace: true });
  }, [lesson, navigate]);

  const presented = classroom.presented;
  // The class remembers the explanation and every answer the student gave. Answers are always
  // in the student's own words, so they count towards teaching even on a slide that was read.
  const answers = useMemo(
    () => classroom.history.flatMap((h) => h.conversation.filter((m) => m.who === 'you').map((m) => m.text)),
    [classroom.history],
  );
  const transcript = useMemo(
    () => [...classroom.history.map((h) => h.said), ...answers].filter(Boolean).join('\n\n'),
    [classroom.history, answers],
  );
  const ownTranscript = useMemo(
    () =>
      [...classroom.history.filter((h) => !h.readAloud).map((h) => h.said), ...answers].filter(Boolean).join('\n\n'),
    [classroom.history, answers],
  );
  const recalledTranscript = useMemo(
    () => classroom.history.filter((h) => h.fromMemory).map((h) => h.said).filter(Boolean).join('\n\n'),
    [classroom.history],
  );
  const readAloudSlides = useMemo(() => classroom.history.filter((h) => h.readAloud).map((h) => h.n), [classroom.history]);

  const run = useCallback(async () => {
    if (!lesson) return;
    setLoading(true);
    setError(null);
    setStage('running');
    try {
      const quiz = stored ?? (await classQuiz({ lesson, presented }));
      const graded = await gradeClassQuiz({
        lesson,
        presented,
        questions: quiz.questions,
        transcript,
        ownTranscript,
        recalledTranscript,
        readAloudSlides,
        misconceptions: classroom.misconceptions,
      });
      setResult(graded);
      session.setClassQuiz(graded);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The class quiz could not be completed.');
      setStage('intro');
    } finally {
      setLoading(false);
    }
  }, [lesson, presented, stored, transcript, ownTranscript, recalledTranscript, readAloudSlides, classroom.misconceptions, session]);

  if (!lesson) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <SessionSteps current="Class quiz" className="mb-5" />
        <SectionHeading
          eyebrow="Class quiz"
          title="Your classmates take the quiz using only your words"
          description="They did not read the slides. They know nothing about the topic except what you taught them. If you never explained an idea, they leave the question blank."
        />

        {error && <ErrorNote className="mt-6" onRetry={() => void run()}>{error}</ErrorNote>}

        {stage === 'intro' && !loading && (
          <div className="mt-8 surface p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip-moss">{presented.length} slides presented</span>
              {readAloudSlides.length > 0 && <span className="chip-clay">{readAloudSlides.length} read out loud</span>}
              {classroom.misconceptions.length > 0 && (
                <span className="chip-clay">{classroom.misconceptions.filter((m) => !m.corrected).length} uncorrected idea(s)</span>
              )}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              The quiz questions are written from your slides, but your classmates answer from your transcript alone. Then each
              answer is checked twice: the quote must be something you really said, and it must actually teach the answer.
            </p>
            <button type="button" className="btn-primary mt-6" onClick={() => void run()}>
              <Users className="h-4 w-4" aria-hidden="true" />
              Start the class quiz
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-8 surface flex flex-col items-center gap-4 p-10">
            <Spinner className="text-base" />
            <p className="display text-lg text-ink">The class is taking the quiz…</p>
            <p className="max-w-md text-center text-sm text-muted">
              They are answering from your words, and each answer is being checked against your transcript.
            </p>
            <ProgressRail value={1} max={2} className="max-w-xs" />
          </div>
        )}

        {stage === 'done' && result && <ClassResults result={result} />}

        {stage === 'done' && result && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Next, take your own quiz to check what you understand.</p>
            <button type="button" className="btn-primary" onClick={() => navigate('/self-quiz')}>
              Take my own quiz
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SOURCE_META: Record<AnswerSource, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  taught: { label: 'Taught', tone: 'text-right border-right/40 bg-right/12', icon: CheckCircle2 },
  'never-taught': { label: 'Never taught', tone: 'text-muted border-line/20 bg-surface/[0.06]', icon: ShieldQuestion },
  'read-aloud': { label: 'Read from the slide', tone: 'text-wrong border-wrong/40 bg-wrong/12', icon: FileText },
  'unverified-quote': { label: 'Quote not found', tone: 'text-wrong border-wrong/40 bg-wrong/12', icon: XCircle },
  'quote-unsupported': { label: 'Quote did not teach it', tone: 'text-wrong border-wrong/40 bg-wrong/12', icon: XCircle },
  misconception: { label: 'From an uncorrected idea', tone: 'text-wrong border-wrong/40 bg-wrong/12', icon: XCircle },
};

function ClassResults({ result }: { result: ClassQuizResult }) {
  const [onlyBlanks, setOnlyBlanks] = useState(false);

  const answers = result.answers ?? [];
  const questions = result.questions ?? [];
  const notes = result.notes ?? [];

  const byQuestion = useMemo(() => {
    const map = new Map<string, ClassAnswer[]>();
    for (const answer of answers) {
      const list = map.get(answer.id) ?? [];
      list.push(answer);
      map.set(answer.id, list);
    }
    return map;
  }, [answers]);

  const tally = useMemo(() => {
    const counts: Record<AnswerSource, number> = {
      taught: 0,
      'never-taught': 0,
      'read-aloud': 0,
      'unverified-quote': 0,
      'quote-unsupported': 0,
      misconception: 0,
    };
    for (const a of answers) counts[a.source] = (counts[a.source] ?? 0) + 1;
    return counts;
  }, [answers]);

  const total = answers.length || 1;
  const taughtPct = Math.round((tally.taught / total) * 100);

  return (
    <div className="mt-8 space-y-6">
      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <ScoreRing value={tally.taught} max={total} label="Your class scored" size="sm" />
            <div>
              <h2 className="display text-lg text-ink">Class results</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                The class answered <strong className="text-ink">{tally.taught}</strong> of{' '}
                <strong className="text-ink">{total}</strong> answers from your words ({taughtPct}%).
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                A blank means you never taught it clearly. A wrong answer means you taught it wrong.
              </p>
            </div>
          </div>
          <SourceTag source={result.source} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['taught', 'never-taught', 'read-aloud', 'misconception'] as AnswerSource[]).map((source) =>
            tally[source] ? (
              <span key={source} className={cn('chip', SOURCE_META[source].tone)}>
                {SOURCE_META[source].label} · {tally[source]}
              </span>
            ) : null,
          )}
        </div>

        <div className="mt-4">
          <ProgressRail value={tally.taught} max={total} />
        </div>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="h-4 w-4 accent-amber" checked={onlyBlanks} onChange={(e) => setOnlyBlanks(e.target.checked)} />
          Show only the questions the class could not answer
        </label>

        {notes.length > 0 && (
          <InfoNote className="mt-4">
            <ul className="space-y-1">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </InfoNote>
        )}
      </div>

      {questions.map((question, index) => {
        const answers = byQuestion.get(question.id) ?? [];
        const allBlank = answers.every((a) => a.choice === null);
        if (onlyBlanks && !allBlank) return null;
        return <QuestionCard key={question.id} question={question} answers={answers} index={index} />;
      })}

      <p className="text-center text-xs leading-relaxed text-muted">
        ClassRelay does not claim perfect scoring. A quote that a model judged to teach an answer may still be arguable — every
        judgement is shown above so you can check it yourself.
      </p>
    </div>
  );
}

function QuestionCard({ question, answers, index }: { question: QuizQuestion; answers: ClassAnswer[]; index: number }) {
  const correctCount = answers.filter((a) => a.source === 'taught' && a.choice === question.answer).length;
  const blankCount = answers.filter((a) => a.choice === null).length;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
      className="surface overflow-hidden"
    >
      <div className="border-b border-line/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="chip">Slide {question.slide}</span>
          <span className="text-2xs uppercase tracking-[0.1em] text-muted">
            {correctCount}/4 answered · {blankCount} blank
          </span>
        </div>
        <h3 className="display mt-2.5 text-base leading-snug text-ink">{question.question}</h3>
        <p className="mt-1 text-xs text-muted">Concept: {question.concept}</p>
      </div>

      <ul className="divide-y divide-line/[0.07]">
        {answers.map((answer) => (
          <ClassmateAnswer key={`${answer.id}-${answer.student}`} answer={answer} question={question} />
        ))}
      </ul>
    </motion.article>
  );
}

function ClassmateAnswer({ answer, question }: { answer: ClassAnswer; question: QuizQuestion }) {
  const mate = CLASSMATES[answer.student];
  const meta = SOURCE_META[answer.source];
  const Icon = meta.icon;
  const correct = answer.choice !== null && answer.choice === question.answer;

  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <ClassmateAvatar id={answer.student} mood={correct ? 'satisfied' : answer.choice === null ? 'confused' : 'skeptical'} className="h-10 w-10 shrink-0 rounded-full bg-paper/60" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: mate.accentHex }}>
            {mate.name}
          </span>
          <span className={cn('chip', meta.tone)}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {meta.label}
          </span>
        </div>

        {answer.choice !== null ? (
          <p className={cn('mt-1.5 text-sm leading-relaxed', correct ? 'text-ink' : 'text-wrong')}>
            Chose: <span className="font-medium">{question.options[answer.choice]}</span>
            {!correct && <span className="ml-1 text-xs uppercase tracking-[0.1em]">(not the slide&rsquo;s answer)</span>}
          </p>
        ) : (
          <p className="mt-1.5 text-sm italic leading-relaxed text-muted">Left it blank.</p>
        )}

        {answer.quote && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-line/10 bg-paper/40 px-3 py-2 text-sm italic leading-relaxed text-ink-soft">
            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pencil-deep" aria-hidden="true" />
            <span>
              Your words: &ldquo;{answer.quote}&rdquo;
            </span>
          </p>
        )}

        <p className="mt-2 text-xs leading-relaxed text-muted">{answer.reason}</p>
      </div>
    </li>
  );
}

export { CLASSMATE_IDS };
