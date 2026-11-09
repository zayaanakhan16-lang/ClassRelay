import { useCallback, useEffect, useRef, useState } from 'react';
import { Dictation, probeMic, speechSupported, type MicActivity } from '@/services/speech';

const IDLE: MicActivity = { audio: false, sound: false, speech: false };

/**
 * Dictation for any text field: the same Web Speech wiring the classroom uses, packaged so
 * quizzes and reasoning boxes get voice input too.
 *
 * It first asks for the microphone and *releases* it (see `probeMic`) so the recognition
 * engine can capture audio, then streams what it hears into the field. The activity flags
 * come from the engine itself, so the UI can show whether the microphone is actually
 * receiving sound instead of pretending a dead button works.
 */
export function useDictation() {
  const [listening, setListening] = useState(false);
  const [activity, setActivity] = useState<MicActivity>(IDLE);
  const [error, setError] = useState<string | null>(null);
  const dictation = useRef<Dictation | null>(null);

  const teardown = useCallback(() => {
    dictation.current?.stop();
    dictation.current = null;
    setListening(false);
    setActivity(IDLE);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  /** `value` is the field's current text; dictation continues after it. */
  const toggle = useCallback(
    (value: string, onText: (text: string) => void) => {
      setError(null);
      if (dictation.current) {
        teardown();
        return;
      }
      void (async () => {
        try {
          await probeMic();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The microphone could not be opened.');
          return;
        }
        // Give the device a moment to be handed over to the recognition engine before it starts.
        await new Promise((resolve) => setTimeout(resolve, 150));
        const d = new Dictation({
          onText,
          onState: (state) => {
            setListening(state);
            if (!state) {
              dictation.current = null;
              setActivity(IDLE);
            }
          },
          onActivity: setActivity,
          onError: (message) => {
            setError(message);
            setListening(false);
            dictation.current = null;
            setActivity(IDLE);
          },
        });
        dictation.current = d;
        d.start(value);
      })();
    },
    [teardown],
  );

  return {
    supported: speechSupported,
    listening,
    /** What the microphone is doing right now — drives the level meter and the silent-mic warning. */
    activity,
    level: activity.speech ? 1 : activity.sound ? 0.6 : activity.audio ? 0.25 : 0,
    error,
    toggle,
    clearError: () => setError(null),
  };
}
