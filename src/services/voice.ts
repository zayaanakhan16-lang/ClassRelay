/**
 * Spoken classmates, via the Web Speech API's speech synthesis.
 *
 * This is the other half of the classroom: speech *recognition* (see `speech.ts`) lets the
 * student talk, and synthesis lets the classmates talk back — so a question arrives the way
 * it would in a real room, not just as text.
 *
 * As with recognition, we never pretend. `speechSynthesis` is missing or silent in some
 * browsers and on some systems, so `voiceSupported` is checked before the UI offers sound,
 * and the transcript is always shown as well. Nothing here is required to use ClassRelay.
 */

import type { ClassmateId } from '@/types';

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export const voiceSupported = Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');

/** Per-classmate delivery, so the four voices stay distinguishable even on one engine. */
export const VOICE_STYLE: Record<ClassmateId, { rate: number; pitch: number; hint: string[] }> = {
  // Mika is younger and hesitant; a touch higher and slower.
  mika: { rate: 0.98, pitch: 1.18, hint: ['Samantha', 'Zira', 'Google UK English Female', 'Female', 'Karen', 'Moira'] },
  // Rafa is direct and a little blunt; lower and even.
  rafa: { rate: 1.0, pitch: 0.82, hint: ['Daniel', 'Google UK English Male', 'Male', 'Alex', 'Rishi'] },
  // Iya is bright and playful; quick and lively.
  iya: { rate: 1.06, pitch: 1.1, hint: ['Tessa', 'Google US English', 'Victoria', 'Female'] },
  // Dev thinks out loud; calm and measured.
  dev: { rate: 0.94, pitch: 0.96, hint: ['Oliver', 'Google UK English Male', 'Male', 'Aaron'] },
};

let cachedVoices: SpeechSynthesisVoice[] = [];

/** English voices, best first: local voices sound more natural and work offline. */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!synth) return [];
  const all = synth.getVoices() ?? [];
  const english = all.filter((v) => /^en\b/i.test(v.lang) || v.lang.toLowerCase().startsWith('en'));
  const pool = english.length ? english : all;
  return [...pool].sort((a, b) => Number(b.localService) - Number(a.localService));
}

/** Voices arrive asynchronously in most browsers; call back once they are ready. */
export function onVoicesReady(cb: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (!synth) return () => {};
  const handle = () => {
    cachedVoices = englishVoices();
    cb(cachedVoices);
  };
  handle();
  synth.addEventListener?.('voiceschanged', handle);
  return () => synth.removeEventListener?.('voiceschanged', handle);
}

/**
 * Assigns a distinct voice to each classmate. Preference is given to a name hint, then the
 * pool is walked so two classmates never share a voice when there is a choice.
 */
export function assignVoices(voices: SpeechSynthesisVoice[], ids: ClassmateId[]): Partial<Record<ClassmateId, SpeechSynthesisVoice>> {
  const used = new Set<string>();
  const out: Partial<Record<ClassmateId, SpeechSynthesisVoice>> = {};
  for (const id of ids) {
    const hints = VOICE_STYLE[id].hint;
    let pick = voices.find((v) => hints.some((h) => v.name.includes(h)) && !used.has(v.name));
    if (!pick) pick = voices.find((v) => !used.has(v.name));
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

export function stopSpeaking(): void {
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    /* ignore */
  }
}

export { cachedVoices };
