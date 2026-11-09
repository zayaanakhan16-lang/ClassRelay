/**
 * Client-side helpers that mirror the server's honesty rules.
 *
 * The server is the source of truth for grading, but the classroom needs to react
 * instantly — for example to show "you are reading the slide" while the student is still
 * speaking. These helpers keep that instant feedback consistent with the server's logic.
 */

const COPIED_RUN = 4;
const MIN_EXPLAIN_WORDS = 8;
export const READ_ALOUD_SHARE = 0.6;

export function normalizeWords(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** How much of an explanation is copied word for word from the slide (0 to 1). */
export function readAloudShare(said: string, slideText: string): number {
  const spoken = normalizeWords(said);
  if (spoken.length < MIN_EXPLAIN_WORDS) return 0;
  const slide = ` ${normalizeWords(slideText).join(' ')} `;
  let copied = 0;
  let pieces = 0;
  for (let i = 0; i + COPIED_RUN <= spoken.length; i++) {
    pieces++;
    if (slide.includes(` ${spoken.slice(i, i + COPIED_RUN).join(' ')} `)) copied++;
  }
  return pieces ? copied / pieces : 0;
}

/** True when the explanation reads as mostly slide text. */
export function looksReadAloud(said: string, slideText: string, allSlideText = ''): boolean {
  return Math.max(readAloudShare(said, slideText), readAloudShare(said, allSlideText)) >= READ_ALOUD_SHARE;
}
