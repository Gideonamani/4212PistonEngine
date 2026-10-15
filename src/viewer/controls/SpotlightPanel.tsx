import React from 'react';
import { Box, Ghost, Highlighter, type LucideIcon } from 'lucide-react';
import { FOCUS_MODES, FOCUS_MODE_HINTS, FOCUS_MODE_LABELS, HIGHLIGHT_FALLBACK_NOTE } from '../core/focus-style.mjs';
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
  /** Highlight is chosen but is being drawn as an X-ray, because it would hide a spotlit part that sits inside another. */
  highlightFallback?: boolean;
  /** Whether the 3D click part property card is enabled */
  showPartCard?: boolean;
  onToggleShowPartCard?: () => void;
};

/**
 * How the spotlit part is shown: coloured with the rest pale, solid with the rest as a faint ghost, or on its own. The same three tiles
 * serve a lesson (the step spotlights the part, the learner chooses the style) and Explore (the learner chooses the part as well).
 */
export function SpotlightPanel({ current, onChoose, disabled = false, status, idleHint, highlightFallback = false, showPartCard = true, onToggleShowPartCard }: SpotlightPanelProps) {
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
          className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'bg-teal-400/20 text-teal-200 font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
        >
          <Icon className={`h-5 w-5 ${selected ? 'text-teal-300' : 'text-slate-400'}`} aria-hidden="true" />
          {FOCUS_MODE_LABELS[mode]}
        </button>;
      })}
    </div>
    <p className="px-0.5 text-xs leading-snug text-slate-400">{current ? FOCUS_MODE_HINTS[current] : idleHint ?? FOCUS_MODE_HINTS.xray}</p>
    {current === 'highlight' && highlightFallback && <p aria-live="polite" className="px-0.5 text-xs leading-snug text-amber-200">{HIGHLIGHT_FALLBACK_NOTE}</p>}

    {onToggleShowPartCard !== undefined && (
      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-200">Show part details on click</span>
          <span className="block text-[11px] text-slate-400">Display property card when selecting 3D parts</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showPartCard}
          aria-label="Show part details on click"
          onClick={onToggleShowPartCard}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
            showPartCard ? 'bg-teal-400' : 'bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
              showPartCard ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    )}
  </div>;
}
