import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClassmateId } from '@/types';
import { CLASSMATE_IDS } from '@/data/classmates';
import { VOICE_STYLE, assignVoices, onVoicesReady, speak, stopSpeaking, voiceSupported } from '@/services/voice';

const STORAGE_KEY = 'classrelay.voice';

/**
 * Owns spoken classmates: which voice each one uses, whether sound is on, and who is
 * speaking right now. Sound is off until the student turns it on, so nothing surprises them
 * and autoplay rules never bite — the toggle is a real user gesture.
 */
export function useVoices() {
  const voiceMap = useRef<Partial<Record<ClassmateId, SpeechSynthesisVoice>>>({});
  const [voicesReady, setVoicesReady] = useState(false);
  const [enabled, setEnabled] = useState(() => {
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
    return onVoicesReady((voices) => {
      voiceMap.current = assignVoices(voices, CLASSMATE_IDS);
      setVoicesReady(voices.length > 0);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      /* storage may be blocked; the toggle still works for this session */
    }
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

  return { supported: voiceSupported, enabled, setEnabled, voicesReady, voiceSpeaking, say, stop, error, clearError: () => setError(null) };
}
