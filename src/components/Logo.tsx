import { cn } from '@/lib/utils';

/**
 * The ClassRelay lockup: the two-students-and-a-relay-arrow mark the product was designed
 * around, with the wordmark beside it.
 *
 * `tone="light"` is the cut for dark board surfaces (the artwork is chalk-white and the
 * wordmark is white); `tone="dark"` is the cut for warm paper surfaces (navy artwork, ink
 * wordmark). Both are the same artwork on a transparent background.
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
  const src = onBoard ? '/brand/classrelay-mark-light.png' : '/brand/classrelay-mark.png';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={src}
        alt="ClassRelay"
        width={Math.round(size * 1.42)}
        height={size}
        style={{ height: size, width: 'auto' }}
        className="shrink-0"
      />
      {withWordmark && (
        <span
          className={cn(
            'display text-[1.28rem] font-extrabold leading-none tracking-[-0.01em]',
            onBoard ? 'text-white' : 'text-ink',
          )}
        >
          ClassRelay
        </span>
      )}
    </span>
  );
}
