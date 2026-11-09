import { Eye, EyeOff, ImageOff } from 'lucide-react';
import type { Slide } from '@/types';
import { cn } from '@/lib/utils';

/**
 * The presentation area.
 *
 * In "Present with slides" the slide stays visible. In "Present from memory" the content
 * is hidden behind a recall panel — only the title stays, so the student knows what they
 * are recalling. Hiding it is what makes saying the slide's words count as recall.
 */
export function SlideStage({
  slide,
  fromMemory,
  revealed,
  onReveal,
  className,
}: {
  slide: Slide | null;
  fromMemory: boolean;
  /** Temporary peek while presenting from memory. */
  revealed: boolean;
  onReveal: (value: boolean) => void;
  className?: string;
}) {
  if (!slide) {
    return (
      <div className={cn('surface flex min-h-[16rem] items-center justify-center p-6 text-muted', className)}>
        No slide selected.
      </div>
    );
  }

  const hidden = fromMemory && !revealed;
  const hasImage = Boolean(slide.image);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-line/12 bg-surface text-ink-strong shadow-lift', className)}>
      {/* Slide header strip */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-strong/10 bg-paper-2/70 px-4 py-2">
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-strong/55">Slide {slide.n}</span>
        {fromMemory && (
          <button
            type="button"
            onClick={() => onReveal(!revealed)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-strong/15 bg-white/70 px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-strong/70 transition hover:bg-white"
          >
            {revealed ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
            {revealed ? 'Hide again' : 'Peek'}
          </button>
        )}
      </div>

      <div className="relative min-h-[15rem] p-5 sm:p-7">
        <p className="display text-xl text-ink-strong sm:text-2xl">{slide.title || `Slide ${slide.n}`}</p>

        <div className={cn('mt-4 transition', hidden && 'select-none blur-[7px] opacity-25')} aria-hidden={hidden}>
          {hasImage && (
            <img
              src={slide.image}
              alt={`Slide ${slide.n} preview`}
              className="mb-4 w-full rounded-lg border border-ink-strong/10"
              loading="lazy"
            />
          )}
          {slide.text.trim() ? (
            <p className="prose-lesson text-ink-strong/85">{slide.text}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink-strong/50">
              <ImageOff className="h-4 w-4" aria-hidden="true" />
              This slide has no selectable text. Explain it from the picture.
            </p>
          )}
        </div>

        {hidden && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/55 px-6 text-center backdrop-blur-[2px]">
            <EyeOff className="h-7 w-7 text-ink-strong/45" aria-hidden="true" />
            <p className="font-display text-base font-semibold text-ink-strong/80">Presenting from memory</p>
            <p className="max-w-xs text-sm text-ink-strong/60">
              Explain this slide without reading it. Saying the slide&rsquo;s words from memory counts as recall, not reading.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
