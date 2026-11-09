/**
 * Spoken classmates, via the Web Speech API's speech synthesis.
 *
 * This is the other half of the classroom: speech *recognition* (see `speech.ts`) lets the
 * student talk, and synthesis lets the classmates talk back — so a question arrives the way
 * it would in a real room, not just as text.
 *
 * Two things matter for it to feel like a real class:
 *   1. Mika and Iya should sound like girls, Rafa and Dev like boys.
 *   2. Each of the four should sound like a *different* person.
 *
 * Browsers expose voices asynchronously and their names are wildly inconsistent across
 * platforms, so we do both: match the known female/male voice names first, and always apply
 * a per-classmate pitch/rate so the gender and the difference are audible even when the
 * system offers only one voice.
 *
 * As with recognition, we never pretend. `speechSynthesis` is missing or silent in some
 * browsers, so `voiceSupported` is checked before the UI offers sound, and the transcript is
 * always shown as well. Nothing here is required to use ClassRelay.
 */

import type { ClassmateId } from '@/types';

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export const voiceSupported = Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');

export type VoiceGender = 'female' | 'male' | 'unknown';

/**
 * Per-classmate delivery. `gender` is what the voice *should* be; `pitch`/`rate` shape the
 * voice so the four stay distinct even if the system only ships one. Mika and Iya are girls,
 * Rafa and Dev are boys.
 */
export const VOICE_STYLE: Record<
  ClassmateId,
  { gender: VoiceGender; rate: number; pitch: number; hint: string[] }
> = {
  // Mika is younger and hesitant; higher and a little slower.
  mika: { gender: 'female', rate: 0.97, pitch: 1.28, hint: ['Samantha', 'Zira', 'Google UK English Female', 'Karen', 'Moira', 'Tessa', 'Victoria'] },
  // Rafa is direct and a little blunt; lower and even.
  rafa: { gender: 'male', rate: 1.0, pitch: 0.78, hint: ['Daniel', 'Google UK English Male', 'Alex', 'Rishi', 'David', 'Mark'] },
  // Iya is bright and playful; quick and lively.
  iya: { gender: 'female', rate: 1.08, pitch: 1.12, hint: ['Tessa', 'Victoria', 'Fiona', 'Google US English', 'Serena', 'Zoe'] },
  // Dev thinks out loud; calm and measured.
  dev: { gender: 'male', rate: 0.94, pitch: 0.9, hint: ['Oliver', 'Google UK English Male', 'Aaron', 'Arthur', 'George', 'Guy'] },
};

/** Names that identify a female voice, across macOS, Windows, Android, Chrome OS and Linux. */
const FEMALE_NAMES = [
  'female', 'woman', 'girl',
  'samantha', 'karen', 'moira', 'tessa', 'victoria', 'fiona', 'serena', 'allison', 'ava',
  'susan', 'zoe', 'nicky', 'kate', 'zira', 'hazel', 'heera', 'amelie', 'joanna', 'salli',
  'kimberly', 'kendra', 'ivy', 'emma', 'amy', 'aria', 'jenny', 'michelle', 'libby', 'sonia',
  'natasha', 'clara', 'emily', 'alice', 'federica', 'ioana', 'laura', 'catherine', 'marie',
  'anna', 'helena', 'vicki', 'marlene', 'yelda', 'dalia', 'paulina', 'monica', 'elena',
  'lucia', 'sara', 'silvia', 'katja', 'hedda', 'nora', 'lisa', 'satu', 'maja', 'shelley',
  'grandma', 'flo', 'sandy', 'shelley', 'google us english', 'en-us-x-sfg',
];

/** Names that identify a male voice. */
const MALE_NAMES = [
  'male', 'man', 'boy',
  'daniel', 'alex', 'fred', 'tom', 'oliver', 'aaron', 'arthur', 'rishi', 'matthew', 'joey',
  'justin', 'brian', 'russell', 'eric', 'christopher', 'guy', 'liam', 'william', 'james',
  'ryan', 'nathan', 'diego', 'jorge', 'thomas', 'rocko', 'reed', 'juan', 'carlos', 'felipe',
  'luca', 'george', 'david', 'mark', 'richard', 'sean', 'paul', 'peter', 'stefan', 'magnus',
  'henrik', 'olav', 'nils', 'mattias', 'yannick', 'hans', 'klaus', 'jorge', 'thiago', 'ralph',
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bruce', 'bubbles', 'cellos', 'deranged',
  'good news', 'hysterical', 'junior', 'organ', 'pipe organ', 'trinoids', 'whisper', 'zarvox',
];

const nameOf = (voice: SpeechSynthesisVoice) => ` ${voice.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Reads a voice's name (and lang) for a gender clue. Female is tested first: "female" contains "male". */
export function classifyVoice(voice: SpeechSynthesisVoice): VoiceGender {
  const name = nameOf(voice);
  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`).test(name);
  if (FEMALE_NAMES.some(hasWord)) return 'female';
  if (MALE_NAMES.some(hasWord)) return 'male';
  return 'unknown';
}

let cachedVoices: SpeechSynthesisVoice[] = [];

/** English voices, best first: local voices sound more natural and work offline. */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!synth) return [];
  const all = synth.getVoices() ?? [];
  const english = all.filter((v) => /^en\b/i.test(v.lang) || v.lang.toLowerCase().startsWith('en'));
  const pool = english.length ? english : all;
  return [...pool].sort((a, b) => Number(b.localService) - Number(a.localService));
}

/**
 * Voices arrive asynchronously in most browsers (Chrome returns an empty list until
 * `voiceschanged` fires). This resolves with the voice list as soon as one is available, or
 * with an empty list after `timeout` so callers never hang.
 */
export function waitForVoices(timeout = 4000): Promise<SpeechSynthesisVoice[]> {
  if (!synth) return Promise.resolve([]);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', onChanged);
      resolve(voices);
    };
    const check = () => {
      const voices = englishVoices();
      if (voices.length) return finish(voices);
      if (Date.now() >= deadline) return finish(voices);
      setTimeout(check, 200);
    };
    const onChanged = () => {
      const voices = englishVoices();
      if (voices.length) finish(voices);
    };
    synth.addEventListener?.('voiceschanged', onChanged);
    check();
  });
}

/** Kept for callers that prefer the event style; now backed by the polling helper. */
export function onVoicesReady(cb: (voices: SpeechSynthesisVoice[]) => void): () => void {
  let cancelled = false;
  void waitForVoices().then((voices) => {
    if (!cancelled) {
      cachedVoices = voices;
      cb(voices);
    }
  });
  return () => {
    cancelled = true;
  };
}

/**
 * Assigns a distinct voice to each classmate, matching the wanted gender.
 *
 * Priority for each classmate: a named hint of the right gender, then any voice of the right
 * gender, then any unused voice. Two classmates never share a voice while there is a choice.
 */
export function assignVoices(
  voices: SpeechSynthesisVoice[],
  ids: ClassmateId[],
): Partial<Record<ClassmateId, SpeechSynthesisVoice>> {
  const used = new Set<string>();
  const out: Partial<Record<ClassmateId, SpeechSynthesisVoice>> = {};
  for (const id of ids) {
    const { gender, hint } = VOICE_STYLE[id];
    const free = (v: SpeechSynthesisVoice) => !used.has(v.name);
    const pick =
      voices.find((v) => free(v) && hint.some((h) => v.name.includes(h))) ??
      voices.find((v) => free(v) && classifyVoice(v) === gender) ??
      voices.find((v) => free(v) && classifyVoice(v) !== (gender === 'female' ? 'male' : 'female')) ??
      voices.find(free);
    if (pick) {
      used.add(pick.name);
      out[id] = pick;
    }
  }
  return out;
}

export interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/**
 * Speaks one line. Any line already in progress is cancelled first, so the classroom never
 * talks over itself — the same "one voice at a time" rule the raised-hand queue enforces.
 */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!voiceSupported || !synth) {
    options.onError?.('This browser cannot speak text aloud.');
    return false;
  }
  const clean = String(text || '').trim();
  if (!clean) return false;

  synth.cancel();
  const utter = new SpeechSynthesisUtterance(clean);
  if (options.voice) utter.voice = options.voice;
  utter.rate = options.rate ?? 1;
  utter.pitch = options.pitch ?? 1;
  utter.volume = 1;
  utter.lang = options.voice?.lang || 'en-US';
  utter.onstart = () => options.onStart?.();
  utter.onend = () => options.onEnd?.();
  utter.onerror = (event) => {
    // "interrupted"/"canceled" fire when we cancel on purpose; they are not failures.
    const reason = (event as SpeechSynthesisErrorEvent).error;
    if (reason === 'interrupted' || reason === 'canceled') {
      options.onEnd?.();
      return;
    }
    options.onError?.('Speech could not be played. The transcript is still shown below.');
    options.onEnd?.();
  };

  // Chrome can stay paused after a cancel; resume before speaking.
  try {
    synth.resume();
  } catch {
    /* ignore */
  }
  synth.speak(utter);
  return true;
}

/**
 * Primes the speech engine on the first user gesture. Chrome (especially on mobile) refuses
 * to speak until the page has been interacted with; calling this from a click unlocks it so
 * the very first classmate question is actually heard.
 */
export function unlockSpeech(): void {
  if (!voiceSupported || !synth) return;
  try {
    const utter = new SpeechSynthesisUtterance(' ');
    utter.volume = 0;
    synth.speak(utter);
    synth.cancel();
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    /* ignore */
  }
}

export { cachedVoices };
