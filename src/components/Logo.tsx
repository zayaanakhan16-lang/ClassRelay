import { cn } from '@/lib/utils';

/**
 * The ClassRelay mark: two students passing an idea along, drawn as a small chalk doodle so
 * it sits naturally in the classroom. The disc uses the board green, the relay arrow the
 * pencil yellow, and the two heads the classmate colours.
 *
 * `tone="light"` is the cut for the dark board surfaces; `tone="dark"` is the cut for warm
 * paper surfaces.
 */
export function Logo({
  className,
  size = 34,
  withWordmark = false,
  tone = 'light',
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  tone?: 'light' | 'dark';
}) {
  const onBoard = tone === 'light';
  const disc = onBoard ? '#F1EFE4' : '#213B33';
  const arrow = '#F2B33D';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" role="img" aria-label="ClassRelay" style={{ height: size, width: size }} className="shrink-0">
        <circle cx="20" cy="20" r="19" fill={disc} />
        {/* two students, one passing to the other */}
        <circle cx="13.5" cy="15" r="3.1" fill="#4F7FE8" />
        <circle cx="26.5" cy="15" r="3.1" fill="#D64561" />
        <path d="M8.5 27c0-3.1 2.3-5 5-5s5 1.9 5 5Z" fill="#4F7FE8" opacity="0.9" />
        <path d="M21.5 27c0-3.1 2.3-5 5-5s5 1.9 5 5Z" fill="#D64561" opacity="0.9" />
        {/* the idea travelling between them */}
        <path
          d="M17 20.5h6"
          stroke={arrow}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M22 18.4l2.2 2.1-2.2 2.1" stroke={arrow} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {withWordmark && (
        <span className={cn('display text-[1.15rem] leading-none', onBoard ? 'text-chalk' : 'text-ink')}>
          Class<span className={onBoard ? 'text-pencil' : 'text-pencil-deep'}>Relay</span>
        </span>
      )}
    </span>
  );
}
