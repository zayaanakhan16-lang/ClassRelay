import { Hand, MessageCircleQuestion, Volume2 } from 'lucide-react';
import { CLASSMATES, CLASSMATE_IDS } from '@/data/classmates';
import { ClassmateAvatar } from '@/components/ClassmateAvatar';
import { DifficultyChip } from '@/components/ui';
import type { ClassmateId, Mood } from '@/types';
import { cn } from '@/lib/utils';
import type { HandState } from './useClassroom';

/**
 * The four classmates sitting around the stage.
 *
 * A classmate with a hand up is visually distinct, and exactly one classmate speaks at a
 * time: the raised-hand queue is enforced upstream, so this component only reflects it.
 */
export function ClassmateRow({
  hands,
  speaking,
  calledOn,
  onCallOn,
  disabled,
  moods,
}: {
  hands: HandState[];
  speaking: { student: ClassmateId; text: string } | null;
  calledOn: ClassmateId | null;
  onCallOn: (id: ClassmateId) => void;
  disabled: boolean;
  moods?: Partial<Record<ClassmateId, Mood>>;
}) {
  const handMap = new Map(hands.map((h) => [h.student, h]));

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CLASSMATE_IDS.map((id) => {
        const mate = CLASSMATES[id];
        const hand = handMap.get(id);
        const isSpeaking = speaking?.student === id;
        const isCalled = calledOn === id;
        const mood: Mood = isSpeaking ? hand?.mood ?? moods?.[id] ?? 'neutral' : moods?.[id] ?? (hand ? hand.mood : 'neutral');

        return (
          <li key={id}>
            <button
              type="button"
              disabled={disabled || !hand}
              onClick={() => hand && onCallOn(id)}
              aria-pressed={isCalled}
              aria-label={hand ? `Call on ${mate.name}: ${hand.question}` : `${mate.name}, hand down`}
              className={cn(
                'relative flex w-full flex-col items-center gap-2 rounded-2xl border px-3 pb-3 pt-4 text-center transition-all duration-300',
                isCalled
                  ? 'border-pencil bg-pencil/[0.12] shadow-[0_0_0_1px_rgba(214,160,60,0.4)]'
                  : isSpeaking
                    ? 'border-line/25 bg-surface/[0.08]'
                    : hand
                      ? 'border-line/20 bg-paper/70 hover:border-pencil/50 hover:bg-paper/70'
                      : 'border-line/10 bg-paper/45',
                (disabled || !hand) && 'cursor-default',
              )}
            >
              {isSpeaking && (
                <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-pencil" aria-hidden="true" />
              )}
              <span className="relative">
                <ClassmateAvatar
                  id={id}
                  mood={mood}
                  handUp={Boolean(hand)}
                  muted={Boolean(speaking) && !isSpeaking}
                  className={cn('h-[4.4rem] w-[4.4rem]', isSpeaking && 'animate-bob')}
                />
              </span>

              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{mate.name}</span>
                <span className="mt-0.5 block text-2xs uppercase tracking-[0.1em] text-muted">{mate.tagline}</span>
              </span>

              {hand ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-pencil/18 px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.1em] text-pencil-deep">
                  <Hand className="h-3 w-3" aria-hidden="true" />
                  {isCalled ? 'Called on' : 'Hand up'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface/[0.06] px-2 py-0.5 text-2xs uppercase tracking-[0.1em] text-muted">
                  Listening
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The current question, shown prominently above the answer box. */
export function SpeakingBubble({
  student,
  text,
  difficulty,
  speaking,
  onReplay,
  canReplay,
}: {
  student: ClassmateId;
  text: string;
  difficulty?: 'warmup' | 'core' | 'challenge';
  /** True while the classmate's voice is playing. */
  speaking?: boolean;
  onReplay?: () => void;
  canReplay?: boolean;
}) {
  const mate = CLASSMATES[student];
  return (
    <div className="flex items-start gap-3 animate-rise-in">
      <ClassmateAvatar id={student} mood="neutral" className={cn('h-11 w-11 shrink-0 rounded-full', speaking && 'animate-bob')} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border-2 border-line bg-pencil-wash/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-xs font-bold" style={{ color: mate.accentHex }}>
            <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
            {mate.name} asks
          </p>
          <DifficultyChip difficulty={difficulty} />
          {speaking && (
            <span className="inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-[0.1em] text-pencil-deep" role="status">
              <Volume2 className="h-3 w-3 animate-pulse" aria-hidden="true" />
              Speaking
            </span>
          )}
          {onReplay && canReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="ml-auto inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-[0.1em] text-muted transition hover:text-ink"
            >
              <Volume2 className="h-3 w-3" aria-hidden="true" />
              Hear again
            </button>
          )}
        </div>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-ink">{text}</p>
      </div>
    </div>
  );
}
