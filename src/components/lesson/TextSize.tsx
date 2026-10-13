import React, { useEffect, useRef, useState } from 'react';
import { useStoredChoice } from '../../data/localChoice';
import { IconButton } from '../ui';

// How large the reading text of a lesson is, for this learner. The page also answers to the browser's own text size and zoom (the text is
// in rem units), but those scale the whole screen, 3D viewer included; this scales only the words, and sits where the words are.

// Smallest to largest, the order the menu lists them. The three small sizes are for a compact view; secondary text never goes below 12 px
// (see .lesson-prose-sm in index.css), so the smallest choice stays readable.
export const TEXT_SIZES = [
  { id: 'smallest', label: 'Smallest', scale: 0.78 },
  { id: 'smaller', label: 'Smaller', scale: 0.85 },
  { id: 'small', label: 'Small', scale: 0.92 },
  { id: 'standard', label: 'Standard', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.15 },
  { id: 'larger', label: 'Larger', scale: 1.3 },
  { id: 'largest', label: 'Largest', scale: 1.5 },
] as const;

export type TextSizeId = (typeof TEXT_SIZES)[number]['id'];

/** What a learner who has not chosen sees: the list starts at the smallest size, so the default is named, not the first entry. */
export const DEFAULT_TEXT_SIZE = TEXT_SIZES.find((size) => size.id === 'standard') ?? TEXT_SIZES[0];

const TEXT_SIZE_KEY = '4212-lesson-text-size';
const IDS = TEXT_SIZES.map((size) => size.id) as TextSizeId[];

/** The learner's text size (kept on this device) and what to do to change it. */
export function useLessonTextSize() {
  const [choice, choose] = useStoredChoice<TextSizeId>(TEXT_SIZE_KEY, IDS);
  const size = TEXT_SIZES.find((candidate) => candidate.id === choice) ?? DEFAULT_TEXT_SIZE;
  return { size, choose };
}

/** The "Aa" button and the small menu of sizes it opens. */
export const TextSizeControl: React.FC<{ value: TextSizeId; onChange: (id: TextSizeId) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <IconButton ref={buttonRef} size="sm" label="Text size" title="Text size" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="text-[13px] font-bold leading-none">Aa</span>
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="group" aria-label="Text size" className="absolute right-0 top-full z-50 mt-1 max-h-[calc(100svh-8rem)] w-48 overflow-y-auto rounded-2xl border border-teal-500/40 bg-panel p-1.5 shadow-2xl">
            {TEXT_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                aria-pressed={size.id === value}
                onClick={() => { onChange(size.id); setOpen(false); buttonRef.current?.focus(); }}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-xs font-semibold transition-colors ${size.id === value ? 'border border-teal-400/40 bg-teal-500/20 text-teal-200' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <span>{size.label}</span>
                <span aria-hidden="true" className="font-bold leading-none" style={{ fontSize: `${0.875 * size.scale}rem` }}>Aa</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
