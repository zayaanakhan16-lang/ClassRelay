import { AlertTriangle, BookOpen, Check, Keyboard, Send, X } from 'lucide-react';
import { speechSupported } from '@/services/speech';
import { useDictation } from '@/hooks/useDictation';
import { ErrorNote, MicButton, MicLevelMeter, Spinner, ThinkingDots } from '@/components/ui';
import type { StudyCard } from '@/types';
import { cn, wordCount } from '@/lib/utils';

/**
 * The explanation input.
 *
 * Voice uses the Web Speech API when the browser supports it, and a plain text box always
 * works. When speech recognition is unavailable the microphone is disabled with a clear
 * explanation rather than a button that silently does nothing.
 */
export function TranscriptPanel({
  value,
  onChange,
  onSubmit,
  busy,
  disabled,
  readingNow,
  submitLabel,
  placeholder,
  helper,
  studySlot,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  disabled?: boolean;
  readingNow?: boolean;
  submitLabel: string;
  placeholder: string;
  helper?: string;
  studySlot?: React.ReactNode;
  className?: string;
}) {
  const dictation = useDictation();
  const { listening, level, activity } = dictation;

  const words = wordCount(value);
  const canSubmit = words >= 3 && !busy && !disabled;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {studySlot}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MicButton
            supported={speechSupported}
            listening={listening}
            level={level}
            onClick={() => dictation.toggle(value, onChange)}
            disabled={disabled}
          />
          <span className="text-2xs uppercase tracking-[0.1em] text-muted">
            {words} word{words === 1 ? '' : 's'}
          </span>
        </div>
        {!speechSupported && (
          <span className="inline-flex items-center gap-1.5 text-2xs text-muted">
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
            Voice is unavailable here — type instead
          </span>
        )}
      </div>

      {listening && (
        <div className="flex items-center gap-3 rounded-xl border border-wrong/30 bg-wrong/[0.06] px-3.5 py-2.5 text-xs text-wrong">
          <MicLevelMeter level={level} listening={listening} />
          <span>
            {activity.speech
              ? 'Listening — the microphone can hear you. Speak naturally; the transcript is editable below.'
              : activity.audio
                ? 'Listening — the microphone is open but has not picked up speech yet. Try speaking a little louder or closer.'
                : 'Starting the microphone… if this stays put, press Speak again or type instead.'}
          </span>
        </div>
      )}

      {dictation.error && <ErrorNote>{dictation.error}</ErrorNote>}
      {readingNow && (
        <div className="flex items-start gap-2.5 rounded-xl border border-pencil/35 bg-pencil/[0.09] px-3.5 py-2.5 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
          <p className="leading-relaxed">
            This looks like the slide text word for word. Reading it out loud will not count as teaching — try saying what it
            means in your own words.
          </p>
        </div>
      )}

      <label className="sr-only" htmlFor="explanation-input">
        Your explanation
      </label>
      <textarea
        id="explanation-input"
        className="field min-h-[7.5rem] resize-y leading-relaxed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
      />

      {helper && <p className="text-xs leading-relaxed text-muted">{helper}</p>}

      <div className="flex items-center justify-end gap-2">
        {busy && <ThinkingDots label="The class is reacting…" className="mr-auto" />}
        <button type="button" className="btn-primary" onClick={onSubmit} disabled={!canSubmit}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/** The pre-class study card, generated only from the slides. */
export function StudyCardPanel({
  card,
  loading,
  error,
  onClose,
  onRequest,
  requested,
}: {
  card: StudyCard | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRequest: () => void;
  requested: boolean;
}) {
  if (!requested) {
    return (
      <button type="button" className="btn-secondary btn-sm w-full justify-center" onClick={onRequest} disabled={loading}>
        {loading ? <Spinner label="Writing a study card…" /> : (
          <>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Study this slide first
          </>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-pencil/30 bg-pencil/[0.07] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-pencil-deep">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Study card · built from your slides only
        </p>
        <button type="button" onClick={onClose} className="text-muted transition hover:text-ink" aria-label="Hide study card">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {loading && <Spinner label="Writing a study card from your slides…" className="mt-3" />}
      {error && <ErrorNote className="mt-3" onRetry={onRequest}>{error}</ErrorNote>}

      {card && !loading && (
        <div className="mt-3 space-y-2.5 text-sm">
          {card.thin ? (
            <p className="leading-relaxed text-ink-soft">{card.gaps}</p>
          ) : (
            <>
              <StudyRow label="What it means" text={card.meaning} />
              {card.example && <StudyRow label="An example" text={card.example} />}
              {card.why && <StudyRow label="Why it works" text={card.why} />}
              {card.mistake && <StudyRow label="Common mistake" text={card.mistake} />}
              {card.gaps && <StudyRow label="What the slides don't say" text={card.gaps} tone="warn" />}
            </>
          )}
          <p className="pt-1 text-xs leading-relaxed text-muted">
            Copying this card out counts as reading, not teaching. The slide will hide while you explain — say it in your own
            words.
          </p>
        </div>
      )}
    </div>
  );
}

function StudyRow({ label, text, tone }: { label: string; text: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-line/10 bg-paper/40 px-3.5 py-2.5">
      <p className={cn('text-2xs font-bold uppercase tracking-[0.12em]', tone === 'warn' ? 'text-wrong' : 'text-pencil-deep')}>{label}</p>
      <p className="mt-1 leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}

export { Check };
