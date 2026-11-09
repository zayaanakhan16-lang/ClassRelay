import { useCallback, useEffect, useRef, useState } from 'react';
import { Dictation, speechSupported } from '@/services/speech';

/**
 * Dictation for any text field: the same Web Speech wiring the classroom uses, packaged so
 * quizzes and reasoning boxes get voice input too. When the browser has no recognition the
 * hook reports `supported: false` and the caller shows the text box instead of a dead mic.
 */
export function useDictation() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useRef<Dictation | null>(null);

  useEffect(() => () => dictation.current?.stop(), []);

  /** `value` is the field's current text; dictation continues after it. */
  const toggle = useCallback((value: string, onText: (text: string) => void) => {
    setError(null);
    if (dictation.current) {
      dictation.current.stop();
      dictation.current = null;
      setListening(false);
      return;
    }
    const d = new Dictation({
      onText,
      onState: (state) => {
        setListening(state);
        if (!state) dictation.current = null;
      },
      onError: (message) => {
        setError(message);
        setListening(false);
        dictation.current = null;
      },
    });
    dictation.current = d;
    d.start(value);
  }, []);

  return { supported: speechSupported, listening, error, toggle, clearError: () => setError(null) };
}
