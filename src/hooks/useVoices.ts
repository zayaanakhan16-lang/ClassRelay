import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClassmateId } from '@/types';
import { CLASSMATE_IDS } from '@/data/classmates';
import { VOICE_STYLE, assignVoices, speak, stopSpeaking, unlockSpeech, voiceSupported, waitForVoices } from '@/services/voice';

const STORAGE_KEY = 'classrelay.voice';

/**
 * Owns spoken classmates: which voice each one uses, whether sound is on, and who is
 * speaking right now.
 *
 * Sound is off until the student turns it on, so nothing surprises them and autoplay rules
 * never bite. Turning it on is a real user gesture, which also *unlocks* the speech engine
 * (Chrome refuses to speak before an interaction) — that is why the first question is
 * actually heard rather than silently dropped.
 */
export function useVoices() {
  const voiceMap = useRef<Partial<Record<ClassmateId, SpeechSynthesisVoice>>>({});
  const [voicesReady, setVoicesReady] = useState(false);
  const [enabled, setEnabledState] = useState(() => {
    if (!voiceSupported) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
      return false;
    }
  });
  const [voiceSpeaking, setVoiceSpeaking] = useState<ClassmateId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voiceSupported) return;
    let alive = true;
    void waitForVoices().then((voices) => {
      if (!alive) return;
      voiceMap.current = assignVoices(voices, CLASSMATE_IDS);
      setVoicesReady(voices.length > 0);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setError(null);
    if (next) {
      // A click, so the engine will now allow speech.
      unlockSpeech();
      // Voices may not have arrived on first load; grab them now that we need them.
      if (!voicesReady) {
        void waitForVoices().then((voices) => {
          if (voices.length) {
            voiceMap.current = assignVoices(voices, CLASSMATE_IDS);
            setVoicesReady(true);
          }
        });
      }
    } else {
      stopSpeaking();
      setVoiceSpeaking(null);
    }
    setEnabledState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      /* storage may be blocked; the toggle still works for this session */
    }
  }, [voicesReady]);

  useEffect(() => {
    if (!enabled) {
      stopSpeaking();
      setVoiceSpeaking(null);
    }
  }, [enabled]);

  /** Speak a classmate's line. Any line already playing is cancelled, so they never overlap. */
  const say = useCallback(
    (id: ClassmateId, text: string) => {
      if (!enabled || !voiceSupported) return;
      const style = VOICE_STYLE[id];
      speak(text, {
        voice: voiceMap.current[id] ?? null,
        rate: style.rate,
        pitch: style.pitch,
        onStart: () => setVoiceSpeaking(id),
        onEnd: () => setVoiceSpeaking((cur) => (cur === id ? null : cur)),
        onError: (message) => {
          setError(message);
          setVoiceSpeaking(null);
        },
      });
    },
    [enabled],
  );

  const stop = useCallback(() => {
    stopSpeaking();
    setVoiceSpeaking(null);
  }, []);

  return {
    supported: voiceSupported,
    enabled,
    setEnabled,
    voicesReady,
    voiceSpeaking,
    say,
    stop,
    error,
    clearError: () => setError(null),
  };
}
