import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Presentation mode.
 *
 * "slides"  — the slide stays visible while the student explains.
 * "memory"  — the slide content is hidden so the student recalls it themselves.
 *
 * The choice is session-wide (it carries across slides) but is never sent anywhere:
 * the server only learns that a slide was explained from memory, because that changes
 * whether saying the slide's words counts as recall or as reading.
 */
export type PresentMode = 'slides' | 'memory';

interface ClassroomModeValue {
  mode: PresentMode;
  setMode: (mode: PresentMode) => void;
  toggle: () => void;
}

const ClassroomModeContext = createContext<ClassroomModeValue | null>(null);

export function ClassroomModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PresentMode>('slides');
  const value = useMemo<ClassroomModeValue>(
    () => ({ mode, setMode, toggle: () => setMode((m) => (m === 'slides' ? 'memory' : 'slides')) }),
    [mode],
  );
  return <ClassroomModeContext.Provider value={value}>{children}</ClassroomModeContext.Provider>;
}

export function useClassroomMode(): ClassroomModeValue {
  const ctx = useContext(ClassroomModeContext);
  if (!ctx) throw new Error('useClassroomMode must be used inside a ClassroomModeProvider.');
  return ctx;
}
