/**
 * Voice input via the Web Speech API.
 *
 * The classroom lets the student *talk* as well as type. Two things have to be true before a
 * word can be transcribed, and they fail in different ways:
 *
 *   1. The browser must be *allowed* to hear the microphone. `probeMic()` asks for permission
 *      and checks a device exists, then releases the microphone immediately. Releasing matters:
 *      `SpeechRecognition` captures audio itself, and holding a second `getUserMedia` stream open
 *      makes some browsers hand the microphone to the first stream and never feed recognition —
 *      the "I can speak but nothing appears" failure.
 *   2. Recognition must actually be receiving sound. `Dictation` reports that honestly using the
 *      engine's own events (`onaudiostart`, `onsoundstart`, `onspeechstart`), so a silent
 *      microphone looks silent instead of looking like a working button.
 *
 * If the browser cannot recognise speech, `speechSupported` is false and the UI falls back to the
 * text box. We never pretend the microphone is working.
 */

const Recognition: SpeechRecognitionConstructor | undefined =
  (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

export const speechSupported = Boolean(Recognition);

/** Whether the page can even ask for the microphone (needs a secure context in most browsers). */
export const micApiSupported =
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Asks for microphone permission and confirms a device is present, then *releases* the
 * microphone so speech recognition can take it. Throws a friendly message when permission is
 * refused or there is no device, which the caller shows to the student.
 */
export async function probeMic(): Promise<void> {
  if (!micApiSupported) {
    throw new Error('This browser cannot open the microphone. Type your explanation instead.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error('Microphone access was blocked. Allow the microphone in your browser settings, then try again.');
    }
    if (name === 'NotFoundError') {
      throw new Error('No microphone was found. Plug one in, or type your explanation instead.');
    }
    throw new Error('The microphone could not be opened. Type your explanation instead.');
  }
  // Hand the microphone straight back to the speech engine.
  for (const track of stream.getTracks()) track.stop();
}

/** What the microphone is currently doing, straight from the recognition engine. */
export interface MicActivity {
  /** The engine has the microphone open. */
  audio: boolean;
  /** It can hear *some* sound. */
  sound: boolean;
  /** It can hear speech. */
  speech: boolean;
}

export interface DictationOptions {
  lang?: string;
  onText?: (text: string) => void;
  onState?: (listening: boolean) => void;
  onActivity?: (activity: MicActivity) => void;
  onError?: (message: string) => void;
}

export class Dictation {
  private readonly lang: string;
  private readonly onText: (text: string) => void;
  private readonly onState: (listening: boolean) => void;
  private readonly onActivity: (activity: MicActivity) => void;
  private readonly onError: (message: string) => void;
  private rec: SpeechRecognition | null = null;
  private active = false;
  private base = '';
  private finalText = '';
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  /** Recognition ends on every pause; a rapid restart loop upsets Chrome, so we back off. */
  private restarts = 0;
  /** Counts how many times the engine heard nothing, so we can say so instead of hanging. */
  private silentRounds = 0;
  private heardSpeech = false;

  constructor({ lang = 'en-US', onText = () => {}, onState = () => {}, onActivity = () => {}, onError = () => {} }: DictationOptions = {}) {
    this.lang = lang;
    this.onText = onText;
    this.onState = onState;
    this.onActivity = onActivity;
    this.onError = onError;
  }

  /** `startingText` lets the student keep what they typed and keep talking after it. */
  start(startingText = ''): boolean {
    if (!speechSupported || !Recognition) {
      this.onError('Voice input is not available in this browser. Type your explanation instead.');
      return false;
    }
    if (this.active) return true;
    this.base = startingText.trim();
    this.finalText = '';
    this.active = true;
    this.restarts = 0;
    this.silentRounds = 0;
    this.heardSpeech = false;
    this.open();
    this.onState(true);
    return true;
  }

  stop(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (!this.active) return;
    this.active = false;
    try {
      this.rec?.stop();
    } catch {
      /* already stopped */
    }
    this.rec = null;
    this.onActivity({ audio: false, sound: false, speech: false });
    this.onState(false);
  }

  private activity(audio: boolean, sound: boolean, speech: boolean): void {
    this.onActivity({ audio, sound, speech });
  }

  private open(): void {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      this.restarts = 0;
    };

    // These four events are the engine telling us what it can hear. They are the only
    // trustworthy signal that the microphone is live.
    rec.onaudiostart = () => this.activity(true, false, false);
    rec.onsoundstart = () => this.activity(true, true, false);
    rec.onspeechstart = () => {
      this.heardSpeech = true;
      this.silentRounds = 0;
      this.activity(true, true, true);
    };
    rec.onaudioend = () => this.activity(false, false, false);
    rec.onspeechend = () => this.activity(true, true, false);
    rec.onsoundend = () => this.activity(true, false, false);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (!this.active) return;
      this.heardSpeech = true;
      this.silentRounds = 0;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) this.finalText += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      this.onText(join(this.base, this.finalText, interim));
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are normal; onend decides what to do about them.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.onError('Microphone access was blocked. Allow it in your browser settings, or type instead.');
      } else if (event.error === 'audio-capture') {
        this.onError('No microphone was found. Plug one in, or type your explanation instead.');
      } else if (event.error === 'network') {
        this.onError('The browser could not reach its speech service. Type your explanation, or try another browser.');
      } else {
        this.onError(`Voice input stopped (${event.error}). Press the mic to try again, or type instead.`);
      }
      this.active = false;
      this.onActivity({ audio: false, sound: false, speech: false });
      this.onState(false);
    };

    // Recognition ends after a pause (and after ~60s in Chrome). Restart it while the student
    // is still presenting, backing off so a failing service does not spin in a tight loop.
    rec.onend = () => {
      this.activity(false, false, false);
      if (!this.active) return;
      this.base = join(this.base, this.finalText, '');
      this.finalText = '';
      // The engine dropped out without ever hearing anything. Rather than silently looping
      // forever, tell the student the microphone is not reaching the page.
      if (!this.heardSpeech) {
        this.silentRounds += 1;
        if (this.silentRounds >= 2) {
          this.active = false;
          this.onState(false);
          this.onError(
            'The microphone is open but no speech is reaching the page. Check that the right input device is selected, that it is not muted, then press Speak again — or type your explanation.',
          );
          return;
        }
      }
      if (this.restarts >= 8) {
        this.active = false;
        this.onState(false);
        this.onError('Voice input kept stopping. Type your explanation instead.');
        return;
      }
      this.restarts += 1;
      this.restartTimer = setTimeout(() => {
        if (!this.active) return;
        try {
          rec.start();
        } catch {
          this.open();
        }
      }, 250);
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* start can throw if called twice; the onend handler recovers */
    }
  }
}

function join(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
}
