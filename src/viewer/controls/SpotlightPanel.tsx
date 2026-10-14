import React from 'react';
import { Box, Ghost, Highlighter, type LucideIcon } from 'lucide-react';
import { FOCUS_MODES, FOCUS_MODE_HINTS, FOCUS_MODE_LABELS } from '../core/focus-style.mjs';
import type { FocusMode } from '../types';

const TILE_ICONS: Record<FocusMode, LucideIcon> = { highlight: Highlighter, xray: Ghost, isolate: Box };

type SpotlightPanelProps = {
  /** How the spotlight is drawn now; undefined while there is none. */
  current?: FocusMode;
  onChoose: (mode: FocusMode) => void;
  /** Explore: nothing is chosen to spotlight yet, so the tiles wait. */
  disabled?: boolean;
  /** A line above the tiles saying what is (or would be) spotlit. */
  status?: React.ReactNode;
  /** The line under the tiles while no style is in force. */
  idleHint?: string;
};

/**
 * How the spotlit part is shown: coloured with the rest pale, solid with the rest as a faint ghost, or on its own. The same three tiles
 * serve a lesson (the step spotlights the part, the learner chooses the style) and Explore (the learner chooses the part as well).
 */
export function SpotlightPanel({ current, onChoose, disabled = false, status, idleHint }: SpotlightPanelProps) {
  return <div className="space-y-2.5">
    {status && <p className="text-xs leading-snug text-slate-300">{status}</p>}
    <div role="group" aria-label="How the highlighted part is shown" className="grid grid-cols-3 gap-1.5">
      {(FOCUS_MODES as FocusMode[]).map((mode) => {
        const Icon = TILE_ICONS[mode];
        const selected = mode === current;
        return <button
          key={mode}
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => onChoose(mode)}
          className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'bg-teal-400/20 text-teal-200 font-bold border-b-2 border-teal-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
        >
          <Icon className={`h-5 w-5 ${selected ? 'text-teal-300' : 'text-slate-400'}`} aria-hidden="true" />
          {FOCUS_MODE_LABELS[mode]}
        </button>;
      })}
    </div>
    <p className="px-0.5 text-xs leading-snug text-slate-400">{current ? FOCUS_MODE_HINTS[current] : idleHint ?? FOCUS_MODE_HINTS.xray}</p>
  </div>;
}
