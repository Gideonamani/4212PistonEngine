import React, { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * The full-screen states that make the app frame hide its own header and tab bar. The screen that goes full-screen sets the flag
 * and the frame reads it, so neither has to be passed through the screens in between.
 */
type ShellChrome = {
  exploreFullPage: boolean;
  setExploreFullPage: Dispatch<SetStateAction<boolean>>;
  lessonImmersive: boolean;
  setLessonImmersive: Dispatch<SetStateAction<boolean>>;
};

const ShellChromeContext = createContext<ShellChrome | undefined>(undefined);

export function ShellChromeProvider({ children }: { children: React.ReactNode }) {
  const [exploreFullPage, setExploreFullPage] = useState(false);
  const [lessonImmersive, setLessonImmersive] = useState(false);
  const value = useMemo(() => ({ exploreFullPage, setExploreFullPage, lessonImmersive, setLessonImmersive }), [exploreFullPage, lessonImmersive]);
  return <ShellChromeContext.Provider value={value}>{children}</ShellChromeContext.Provider>;
}

export function useShellChrome(): ShellChrome {
  const value = useContext(ShellChromeContext);
  if (!value) throw new Error('useShellChrome must be used inside ShellChromeProvider');
  return value;
}
