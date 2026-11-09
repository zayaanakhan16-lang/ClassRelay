/**
 * Text utilities shared by every ClassRelay task.
 *
 * These are the honest-scoring primitives. They are deliberately small and pure so they
 * can be reasoned about and unit-tested: the entire promise that "the class quiz only
 * uses your own words" rests on `quoteIsReal` and `readAloudShare` behaving exactly as
 * described here.
 */

const MIN_QUOTE_WORDS = 4;
const COPIED_RUN = 4;
const COPIED_SHARE = 0.6;
const MIN_EXPLAIN_WORDS = 8;
const READ_ALOUD_SHARE = 0.6;

export function str(value, max = 1000) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)} \u2026` : s;
}

export function int(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function arr(value) {
  return Array.isArray(value) ? value : [];
}

/** Lowercase, strip punctuation, split into words. Used for every comparison. */
export function normalizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * True when the quote (or most of it) appears word for word in what the student said.
 * A 4-word sliding window tolerates small slips without letting the AI invent a quote.
 */
export function quoteIsReal(quote, spokenWords) {
  const q = normalizeWords(quote);
  if (q.length < MIN_QUOTE_WORDS) return false;
  const haystack = ` ${spokenWords.join(' ')} `;
  if (haystack.includes(` ${q.join(' ')} `)) return true;
  let found = 0;
  let total = 0;
  for (let i = 0; i + MIN_QUOTE_WORDS <= q.length; i++) {
    total++;
    if (haystack.includes(` ${q.slice(i, i + MIN_QUOTE_WORDS).join(' ')} `)) found++;
  }
  return total > 0 && found / total >= 0.6;
}

function indexOfWords(words, part, from = 0) {
  outer: for (let i = Math.max(0, from); i + part.length <= words.length; i++) {
    for (let k = 0; k < part.length; k++) if (words[i + k] !== part[k]) continue outer;
    return i;
  }
  return -1;
}

/**
 * The words the student really said, for a quote that was only a close match. The AI may
 * add words (even the answer itself) or drop one (like "not"), so the stored quote is
 * replaced by the actual span of the transcript. Returns null when too much of the quote
 * was never said.
 */
export function realQuote(quote, spokenWords) {
  const q = normalizeWords(quote);
  if (` ${spokenWords.join(' ')} `.includes(` ${q.join(' ')} `)) return quote;
  const N = MIN_QUOTE_WORDS;
  let start = -1;
  let first = -1;
  for (let i = 0; i + N <= q.length; i++) {
    start = indexOfWords(spokenWords, q.slice(i, i + N));
    if (start !== -1) {
      first = i;
      break;
    }
  }
  if (start === -1) return null;
  const covered = new Array(q.length).fill(false);
  covered.fill(true, first, first + N);
  let end = start + N;
  for (let i = first + 1; i + N <= q.length; i++) {
    const at = indexOfWords(spokenWords, q.slice(i, i + N), start);
    if (at !== -1 && at - start <= i - first + 3) {
      end = Math.max(end, at + N);
      covered.fill(true, i, i + N);
    }
  }
  if (covered.filter((c) => !c).length > 2) return null;
  const lead = covered.indexOf(true);
  const trail = q.length - 1 - covered.lastIndexOf(true);
  const from = Math.max(0, start - (lead > 0 ? lead + 2 : 0));
  const to = Math.min(spokenWords.length, end + (trail > 0 ? trail + 2 : 0));
  return spokenWords.slice(from, to).join(' ');
}

/**
 * How much of an explanation is copied word for word from the slide (0 to 1).
 * Counted in 4-word pieces, so a few shared terms do not count, only copied phrases.
 */
export function readAloudShare(said, slideText) {
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

export function copiedRun(quote, slideText) {
  if (!String(slideText).trim()) return false;
  const q = normalizeWords(quote);
  const covered = new Array(q.length).fill(false);
  for (let i = 0; i + COPIED_RUN <= q.length; i++) {
    if (String(slideText).includes(` ${q.slice(i, i + COPIED_RUN).join(' ')} `)) covered.fill(true, i, i + COPIED_RUN);
  }
  const copied = covered.filter(Boolean).length;
  return copied > 0 && copied / q.length >= COPIED_SHARE;
}

/**
 * A slide sentence the student wrapped in their own explanation counts as teaching;
 * one they only read out, with nothing of their own around it, does not.
 */
const CONTEXT_WORDS = 20;
export function copiedInContext(quote, transcript, slideText) {
  const q = normalizeWords(quote);
  const head = q.slice(0, MIN_QUOTE_WORDS).join(' ');
  if (!head) return copiedRun(quote, slideText);
  for (const block of String(transcript || '').split(/\n\n+/)) {
    const words = normalizeWords(block);
    const hay = ` ${words.join(' ')} `;
    const at = hay.indexOf(` ${head} `);
    if (at === -1) continue;
    const start = hay.slice(0, at).split(' ').filter(Boolean).length;
    const around = words.slice(Math.max(0, start - CONTEXT_WORDS), start + q.length + CONTEXT_WORDS).join(' ');
    return copiedRun(around, slideText);
  }
  return copiedRun(quote, slideText);
}

/** Everything the presenter said, from the class history, in order. */
export function presenterText(history) {
  return arr(history)
    .flatMap((h) => [
      str(h?.said, 8000),
      ...arr(h?.conversation)
        .filter((m) => m?.who === 'you')
        .map((m) => str(m.text, 1500)),
    ])
    .join(' ')
    .trim();
}

/** Quotes of 2 or 3 words are accepted only when they appear exactly. */
export function quoteFound(quote, words) {
  const q = normalizeWords(quote);
  if (!q.length) return false;
  if (q.length >= 4) return quoteIsReal(quote, words);
  return q.length >= 2 && ` ${words.join(' ')} `.includes(` ${q.join(' ')} `);
}

/** Rough word count, used for "did they actually explain anything" checks. */
export function wordCount(text) {
  return normalizeWords(text).length;
}

/**
 * Keeps long transcripts inside a token budget without cutting the newest slides off.
 * Every slide block keeps a fair share; the longest blocks are trimmed first.
 */
export function fitPerSlide(text, max) {
  const t = String(text || '');
  if (t.length <= max) return t;
  const blocks = t.split(/\n\n+/);
  const room = Math.max(0, max - blocks.length * 6);
  const sorted = blocks.map((b) => b.length).sort((a, b) => a - b);
  let left = room;
  let cap = 0;
  for (let i = 0; i < sorted.length; i++) {
    const share = Math.floor(left / (sorted.length - i));
    if (sorted[i] <= share) {
      left -= sorted[i];
      cap = sorted[i];
    } else {
      cap = share;
      break;
    }
  }
  return blocks.map((b) => (b.length <= cap ? b : `${b.slice(0, Math.max(0, cap))} \u2026`)).join('\n\n');
}

const LIMITS = { slideText: 4000, material: 60000, said: 8000, transcript: 60000 };

/** Renders slide material for a prompt, keeping one focus slide in full. */
export function formatMaterial(material, max = LIMITS.material, focus = 0) {
  const slides = arr(material).map((s) => ({ n: int(s.n), text: str(s.text, LIMITS.slideText).trim() }));
  const full = slides.reduce((sum, s) => sum + s.text.length + 20, 0);
  const focused = slides.find((s) => s.n === focus);
  const others = slides.length - (focused ? 1 : 0);
  const share =
    full <= max
      ? Infinity
      : Math.max(150, Math.floor((max - (focused ? focused.text.length : 0) - 30 * slides.length) / Math.max(1, others)));
  const text = slides
    .map((s) => `--- Slide ${s.n} ---\n${(s === focused ? s.text : str(s.text, share)) || '(no text on this slide)'}`)
    .join('\n\n');
  return str(text, max);
}

export { MIN_QUOTE_WORDS, READ_ALOUD_SHARE, MIN_EXPLAIN_WORDS };
