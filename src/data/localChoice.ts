import { useCallback, useState } from 'react';

// Small choices a learner makes about how the app looks to them (lesson layout, how a spotlight is drawn), kept on this device only.
// Storage can be blocked (private windows, site data cleared), so a read falls back to "no choice" and a write is simply dropped.

export function readChoice<T extends string>(key: string, allowed: readonly T[]): T | undefined {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeChoice(key: string, value: string | undefined) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not remembered; the choice still holds until the page is closed.
  }
}

/** A remembered choice: `undefined` until the learner makes one, then their pick, kept for next time. */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[]) {
  const [value, setValue] = useState<T | undefined>(() => readChoice(key, allowed));
  const choose = useCallback((next: T | undefined) => {
    setValue(next);
    writeChoice(key, next);
  }, [key]);
  return [value, choose] as const;
}
