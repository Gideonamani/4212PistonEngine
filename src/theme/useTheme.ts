import { useCallback, useEffect, useState } from 'react';
import { readChoice, writeChoice } from '../data/localChoice';
import { DARK_QUERY, THEMES, THEME_COLOR, THEME_KEY, otherTheme, resolveTheme } from './theme.mjs';

export type Theme = 'light' | 'dark';

const systemPrefersDark = () => {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return true; // The app was drawn dark; with no answer from the device, stay with that.
  }
};

/**
 * The colour theme. It follows the device (and changes with it, for example at sunset) until the learner presses the theme button;
 * from then on their choice is kept on this device. The page's data-theme attribute is what the stylesheet reads.
 */
export function useTheme() {
  const [choice, setChoice] = useState<Theme | undefined>(() => readChoice<Theme>(THEME_KEY, THEMES as Theme[]));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const theme = resolveTheme(choice, systemDark) as Theme;

  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia(DARK_QUERY);
    } catch {
      return undefined;
    }
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const toggle = useCallback(() => {
    const next = otherTheme(theme) as Theme;
    setChoice(next);
    writeChoice(THEME_KEY, next);
  }, [theme]);

  return { theme, toggle };
}
