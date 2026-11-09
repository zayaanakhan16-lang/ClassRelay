import type { ClassmateId, Mood } from '@/types';
import { cn } from '@/lib/utils';

/**
 * The four AI classmates.
 *
 * The faces are the hand-drawn portraits from the reference project: each classmate is a
 * coloured disc with a distinct silhouette, hair shape and accessory, so Mika, Rafa, Iya
 * and Dev read as four different people rather than one avatar recoloured four times.
 *
 * Drawn rather than photographed on purpose: a classroom of illustrated faces reads as a
 * study tool, not a surveillance feed.
 *
 * The face paths are authored as real SVG elements (JSX children), not markup strings, so
 * every path is a live node the browser can style and animate.
 */

const INK = '#213b33';
const CHEEK = '#f07a6a';

/** One hand-drawn face per classmate, in a 64×64 box. */
function Face({ id }: { id: ClassmateId }) {
  switch (id) {
    case 'mika':
      // Long dark hair framing the face.
      return (
        <>
          <path d="M8 66C10 51 21 46 32 46s22 5 24 20Z" fill="#fffcf6" />
          <rect x="28.5" y="38" width="7" height="10" rx="3" fill="#f3cda6" />
          <path d="M15 31C15 16 23 10 32 10s17 6 17 21v12H15Z" fill="#2b2118" />
          <ellipse cx="32" cy="30" rx="12" ry="13" fill="#f3cda6" />
          <path d="M19.5 27C20 18 26 15 32.5 15S44.5 19 44.5 26C40 22.5 34 21.5 28 23.5 24.5 24.5 22 25.6 19.5 27Z" fill="#2b2118" />
          <circle cx="27.5" cy="31" r="1.8" fill={INK} />
          <circle cx="36.5" cy="31" r="1.8" fill={INK} />
          <circle cx="23.5" cy="35" r="2.2" fill={CHEEK} opacity=".35" />
          <circle cx="40.5" cy="35" r="2.2" fill={CHEEK} opacity=".35" />
          <path d="M29.5 37q2.5 1.6 5 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'rafa':
      // Glasses, because Rafa wants to see the evidence.
      return (
        <>
          <path d="M8 66C10 51 21 46 32 46s22 5 24 20Z" fill="#fffcf6" />
          <rect x="28.5" y="38" width="7" height="10" rx="3" fill="#c98b5e" />
          <ellipse cx="32" cy="31" rx="12" ry="13" fill="#c98b5e" />
          <path d="M19.6 28C18.5 17 25.5 12 33 12s13 5.5 11.4 16C42 22.5 38 20.5 32 20.5S22.5 22.5 19.6 28Z" fill="#1d1712" />
          <path d="M24.5 27.4l5-.8M34.3 25.6q3-1.8 5.6.2" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="27.5" cy="31" r="1.6" fill={INK} />
          <circle cx="36.5" cy="31" r="1.6" fill={INK} />
          <circle cx="23.5" cy="35" r="2.2" fill={CHEEK} opacity=".35" />
          <circle cx="40.5" cy="35" r="2.2" fill={CHEEK} opacity=".35" />
          <g stroke={INK} strokeWidth="1.4" fill="none">
            <circle cx="27.5" cy="31" r="4" />
            <circle cx="36.5" cy="31" r="4" />
            <path d="M31.5 31h1" />
          </g>
          <path d="M29 37.4q4 1.4 7-1.4" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'iya':
      // A bun and wide, curious eyes.
      return (
        <>
          <path d="M8 66C10 51 21 46 32 46s22 5 24 20Z" fill="#fffcf6" />
          <rect x="28.5" y="38" width="7" height="10" rx="3" fill="#e8b48a" />
          <circle cx="32" cy="10.5" r="6.5" fill="#5a3220" />
          <ellipse cx="32" cy="31" rx="12" ry="13" fill="#e8b48a" />
          <path d="M19.2 30C18 19 25 14.5 32 14.5S46 19 44.8 30C42.5 23.5 37.5 20.5 32 20.5S21.5 23.5 19.2 30Z" fill="#5a3220" />
          <circle cx="27.5" cy="31" r="2" fill={INK} />
          <circle cx="36.5" cy="31" r="2" fill={INK} />
          <circle cx="28.2" cy="30.3" r=".6" fill="#fff" />
          <circle cx="37.2" cy="30.3" r=".6" fill="#fff" />
          <circle cx="23.5" cy="35" r="2.2" fill={CHEEK} opacity=".35" />
          <circle cx="40.5" cy="35" r="2.2" fill={CHEEK} opacity=".35" />
          <ellipse cx="32" cy="37.6" rx="1.9" ry="2.1" fill={INK} />
        </>
      );
    case 'dev':
      // A head of curls and round glasses, the connection maker.
      return (
        <>
          <path d="M8 66C10 51 21 46 32 46s22 5 24 20Z" fill="#fffcf6" />
          <rect x="28.5" y="38" width="7" height="10" rx="3" fill="#8d5a3b" />
          <g fill="#15110e">
            <circle cx="21.5" cy="23" r="5" />
            <circle cx="25.5" cy="16.5" r="5.5" />
            <circle cx="32" cy="14" r="6" />
            <circle cx="38.5" cy="16.5" r="5.5" />
            <circle cx="42.5" cy="23" r="5" />
            <circle cx="20" cy="29" r="3.6" />
            <circle cx="44" cy="29" r="3.6" />
          </g>
          <ellipse cx="32" cy="32" rx="11.5" ry="12.5" fill="#8d5a3b" />
          <path d="M21 26c3-3.5 7-5 11-5s8 1.5 11 5c-3-1.5-7-2.4-11-2.4s-8 .9-11 2.4Z" fill="#15110e" />
          <circle cx="27.5" cy="31.5" r="1.3" fill={INK} />
          <circle cx="36.5" cy="31.5" r="1.3" fill={INK} />
          <g stroke={INK} strokeWidth="1.4" fill="none">
            <circle cx="27.5" cy="31.5" r="4" />
            <circle cx="36.5" cy="31.5" r="4" />
            <path d="M31.5 31.5h1" />
          </g>
          <path d="M28.5 37q3.5 2.6 7 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

/** A small raised hand, drawn as a badge so it reads even at chip size. */
function HandBadge() {
  return (
    <span className="absolute -right-2.5 -top-3.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-pencil">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          fill={INK}
          d="M18 8a1.5 1.5 0 0 0-1.5 1.5V12h-.5V5.5a1.5 1.5 0 0 0-3 0V11h-.5V4.5a1.5 1.5 0 0 0-3 0V11H9V6.5a1.5 1.5 0 0 0-3 0v8.3l-1.2-1.6a1.6 1.6 0 0 0-2.5 2l3.6 4.7A6 6 0 0 0 10.7 22H14a5.5 5.5 0 0 0 5.5-5.5v-7A1.5 1.5 0 0 0 18 8Z"
        />
      </svg>
    </span>
  );
}

/**
 * The mood badge, the way a mood marker works in a real classroom app:
 * ? confused, ~ not sure, ✓ following, ¶ understood from the slide.
 */
const MOOD_FACE: Partial<Record<Mood, { glyph: string; fill: string; label: string }>> = {
  confused: { glyph: '?', fill: '#B8334B', label: 'Confused' },
  skeptical: { glyph: '~', fill: '#C3870F', label: 'Not sure yet' },
  curious: { glyph: '?', fill: '#4F7FE8', label: 'Curious' },
  connecting: { glyph: '~', fill: '#4F7FE8', label: 'Connecting' },
  satisfied: { glyph: '✓', fill: '#1D7F57', label: 'Following' },
};

function MoodBadge({ mood }: { mood: Mood }) {
  const entry = MOOD_FACE[mood];
  if (!entry) return null;
  return (
    <span
      className="absolute -bottom-1 -left-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-surface font-sans text-[11px] font-bold leading-none text-white"
      style={{ background: entry.fill }}
      title={entry.label}
      aria-hidden="true"
    >
      {entry.glyph}
    </span>
  );
}

export const CLASSMATE_COLORS: Record<ClassmateId, string> = {
  mika: '#4F7FE8',
  rafa: '#D64561',
  iya: '#1F9E77',
  dev: '#8A63D2',
};

interface FaceProps {
  id: ClassmateId;
  mood?: Mood;
  className?: string;
  /** Draws the raised-hand badge next to the face. */
  handUp?: boolean;
  /** Dims the face while another classmate is speaking. */
  muted?: boolean;
  /** The classmate's name, used for the accessible label. */
  name?: string;
}

/**
 * A classmate portrait: a coloured disc with a hand-drawn face, plus optional mood and
 * raised-hand badges.
 */
export function ClassmateAvatar({ id, mood = 'neutral', className, handUp = false, muted = false, name }: FaceProps) {
  const moodLabel = MOOD_FACE[mood]?.label;
  const label = name ? [name, moodLabel].filter(Boolean).join(', ') : `${id} portrait`;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-full text-white',
        'shadow-[inset_0_-3px_0_rgba(0,0,0,0.12),0_2px_6px_-2px_rgba(30,27,22,0.35)]',
        'transition-all duration-300',
        muted && 'opacity-55 saturate-[0.65]',
        className,
      )}
      style={{ background: CLASSMATE_COLORS[id] }}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <Face id={id} />
      </svg>
      <MoodBadge mood={mood} />
      {handUp && <HandBadge />}
    </span>
  );
}

/** A small circular avatar used in lists and bubbles. */
export function ClassmateChip({
  id,
  mood = 'neutral',
  size = 40,
  className,
}: {
  id: ClassmateId;
  mood?: Mood;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex shrink-0 overflow-hidden rounded-full', className)} style={{ width: size, height: size }}>
      <ClassmateAvatar id={id} mood={mood} className="h-full w-full" />
    </span>
  );
}
