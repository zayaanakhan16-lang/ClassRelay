import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, FileUp, GraduationCap, Info, Loader2, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';
import { SAMPLE_LESSON } from '@/data/sampleLesson';
import { CLASSMATE_LIST } from '@/data/classmates';
import { ClassmateAvatar } from '@/components/ClassmateAvatar';
import { DemoBanner, ErrorNote, InfoNote, SectionHeading } from '@/components/ui';
import { loadSlides } from '@/services/pdf';
import { useSession } from '@/hooks/useSession';
import { cn, uid } from '@/lib/utils';
import type { Lesson, Slide } from '@/types';

type Stage = 'idle' | 'loading' | 'ready';

export function StartPage({ demo }: { demo: boolean }) {
  const navigate = useNavigate();
  const { startLesson, lesson: existingLesson } = useSession();

  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [title, setTitle] = useState('');
  const [newToTopic, setNewToTopic] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const useSample = useCallback(() => {
    setError(null);
    const sample: Lesson = { ...SAMPLE_LESSON, createdAt: Date.now() };
    setDraft(sample);
    setTitle(sample.title);
    setStage('ready');
  }, []);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStage('loading');
    setProgress({ done: 0, total: 0 });
    try {
      const result = await loadSlides(file, (done, total) => setProgress({ done, total }));
      if (!result.slides.length) throw new Error('No pages could be read from that PDF.');
      const readable = result.slides.filter((s) => s.text.trim().length > 20).length;
      setDraft({
        id: uid('lesson'),
        title: file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled lesson',
        source: 'pdf',
        fileName: file.name,
        slides: result.slides,
        createdAt: Date.now(),
      });
      setTitle(file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled lesson');
      setStage('ready');
      if (readable === 0) {
        setError('That PDF has almost no selectable text — it may be scanned images. The classmates will have very little to work with.');
      } else if (result.truncated) {
        setError(`This PDF has more than ${result.slides.length} pages. Only the first ${result.slides.length} were loaded.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That PDF could not be read.');
      setStage('idle');
    }
  }, []);

  const begin = useCallback(() => {
    if (!draft) return;
    startLesson({ ...draft, title: title.trim() || draft.title }, newToTopic);
    navigate('/classroom');
  }, [draft, title, newToTopic, startLesson, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <SectionHeading
          eyebrow="Start learning"
          title="Set up the lesson you are going to teach"
          description="Upload your slides as a PDF, or try the built-in photosynthesis lesson. Nothing is uploaded to a server — your PDF is read in this browser."
        />

        <div className="mt-8 space-y-4">
          {demo && <DemoBanner />}
          {existingLesson && (
            <InfoNote>
              You have a lesson in progress: <strong className="text-ink">{existingLesson.title}</strong>. Choosing a new
              lesson here replaces it.
            </InfoNote>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* Left: input */}
          <div className="space-y-5">
            <div className="surface p-5">
              <h3 className="display text-lg text-ink">1. Choose your slides</h3>
              <p className="mt-1 text-sm text-muted">A PDF export of your slides works best. PowerPoint and Google Slides can both export to PDF.</p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void handleFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  'mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition',
                  dragging ? 'border-pencil/70 bg-pencil/[0.07]' : 'border-line/15 bg-paper/35 hover:border-line/28',
                )}
              >
                {stage === 'loading' ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-pencil-deep" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-ink">
                      Reading your slides… {progress.done}/{progress.total}
                    </p>
                    <p className="mt-1 text-xs text-muted">Extracting text and rendering each page. This stays on your device.</p>
                  </>
                ) : (
                  <>
                    <FileUp className="h-7 w-7 text-muted" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-ink">Drop a PDF here, or choose a file</p>
                    <p className="mt-1 text-xs text-muted">Up to 30 MB and 40 slides. The file never leaves your browser.</p>
                    <button type="button" className="btn-secondary btn-sm mt-4" onClick={() => inputRef.current?.click()}>
                      Choose a PDF
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-surface/12" aria-hidden="true" />
                <span className="text-2xs uppercase tracking-[0.16em] text-muted">or</span>
                <span className="h-px flex-1 bg-surface/12" aria-hidden="true" />
              </div>

              <button type="button" onClick={useSample} className="btn-secondary mt-4 w-full">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Try the sample lesson on photosynthesis
              </button>
            </div>

            <div className="surface p-5">
              <h3 className="display text-lg text-ink">2. Name your lesson</h3>
              <label className="label mt-3" htmlFor="lesson-title">
                Lesson title
              </label>
              <input
                id="lesson-title"
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Photosynthesis"
                maxLength={120}
              />
            </div>

            <div className="surface p-5">
              <h3 className="display text-lg text-ink">3. How confident are you?</h3>
              <label
                className={cn(
                  'mt-3 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition',
                  newToTopic ? 'border-pencil/50 bg-pencil/[0.08]' : 'border-line/15 bg-paper/40 hover:border-line/28',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-amber"
                  checked={newToTopic}
                  onChange={(e) => setNewToTopic(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">I&rsquo;m new to this</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                    Before you present, ClassRelay writes a short study card for each slide using only your slides — what it
                    means, an example, and what the slides leave unsaid. Then the slide hides and you explain it from memory.
                  </span>
                </span>
              </label>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                You can also ask for a study card on any single slide from inside the classroom.
              </p>
            </div>
          </div>

          {/* Right: preview + classmates */}
          <div className="space-y-5">
            <div className="surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="display text-lg text-ink">Preview</h3>
                {draft && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-muted"
                    onClick={() => {
                      setDraft(null);
                      setStage('idle');
                      setError(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear
                  </button>
                )}
              </div>

              {error && <ErrorNote className="mt-3">{error}</ErrorNote>}

              {draft ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="chip-moss">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {draft.slides.length} slide{draft.slides.length === 1 ? '' : 's'}
                    </span>
                    <span className="chip">{draft.source === 'pdf' ? 'From your PDF' : 'Built-in sample'}</span>
                  </div>
                  <ul className="mt-4 max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
                    {draft.slides.map((slide) => (
                      <SlidePreview key={slide.n} slide={slide} />
                    ))}
                  </ul>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-line/15 px-4 py-10 text-center">
                  <p className="text-sm text-muted">Your slides will appear here once you upload a PDF or load the sample.</p>
                </div>
              )}

              <button type="button" className="btn-primary mt-5 w-full" disabled={!draft} onClick={begin}>
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                Enter the classroom
              </button>
            </div>

            <div className="surface p-5">
              <h3 className="display text-lg text-ink">Who will be listening</h3>
              <p className="mt-1 text-sm text-muted">Four classmates with different ways of questioning.</p>
              <ul className="mt-4 space-y-3">
                {CLASSMATE_LIST.map((mate) => (
                  <li key={mate.id} className="flex items-center gap-3">
                    <ClassmateAvatar id={mate.id} mood="neutral" className="h-10 w-10 shrink-0 rounded-full bg-paper/60" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {mate.name} <span className="font-normal text-muted">· {mate.role}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">{mate.example}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-2 text-xs text-muted">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pencil-deep" aria-hidden="true" />
                They ask questions but never give you the answers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlidePreview({ slide }: { slide: Slide }) {
  const [expanded, setExpanded] = useState(false);
  const preview = slide.text.trim() || '(no text on this slide)';
  const long = preview.length > 220;
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-line/10 bg-paper/45 p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-pencil-deep">Slide {slide.n}</span>
        {!slide.text.trim() && <span className="chip-clay">Image only</span>}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink">{slide.title || `Slide ${slide.n}`}</p>
      <p className={cn('mt-1 whitespace-pre-line text-xs leading-relaxed text-muted', !expanded && long && 'line-clamp-3')}>
        {preview}
      </p>
      {long && (
        <button type="button" className="mt-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-pencil-deep" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </motion.li>
  );
}
