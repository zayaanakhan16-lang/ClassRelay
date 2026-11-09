/**
 * Voice input via the Web Speech API.
 *
 * If the browser does not support speech recognition, `speechSupported` is false and the
 * classroom falls back to a text box. We never pretend the microphone is working: the UI
 * checks `speechSupported` and says so plainly.
 */

const Recognition: SpeechRecognitionConstructor | undefined =
  (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

export const speechSupported = Boolean(Recognition);

export interface DictationOptions {
  lang?: string;
  onText?: (text: string) => void;
  onState?: (listening: boolean) => void;
  onError?: (message: string) => void;
}

export class Dictation {
  private readonly lang: string;
  private readonly onText: (text: string) => void;
  private readonly onState: (listening: boolean) => void;
  private readonly onError: (message: string) => void;
  private rec: SpeechRecognition | null = null;
  private active = false;
  private base = '';
  private finalText = '';

  constructor({ lang = 'en-US', onText = () => {}, onState = () => {}, onError = () => {} }: DictationOptions = {}) {
    this.lang = lang;
    this.onText = onText;
    this.onState = onState;
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
    this.open();
    this.onState(true);
    return true;
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    try {
      this.rec?.stop();
    } catch {
      /* already stopped */
    }
    this.onState(false);
  }

  private open(): void {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (!this.active) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) this.finalText += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      this.onText(join(this.base, this.finalText, interim));
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.onError('Microphone access was blocked. Allow it in your browser settings, or type instead.');
      } else if (event.error === 'network') {
        this.onError('Your browser could not reach its speech service. This happens in some browsers or behind a network filter. Type instead.');
      } else {
        this.onError(`Voice input stopped (${event.error}). Press the mic to try again, or type instead.`);
      }
      this.active = false;
      this.onState(false);
    };

    // Chrome ends recognition after a pause; restart it while the student is still presenting.
    rec.onend = () => {
      if (!this.active) return;
      this.base = join(this.base, this.finalText, '');
      this.finalText = '';
      try {
        rec.start();
      } catch {
        this.open();
      }
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
