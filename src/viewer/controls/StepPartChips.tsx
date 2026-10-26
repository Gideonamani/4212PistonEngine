import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHIPS_COLLAPSED_LIMIT, chipsOffered, stepPartChips, toggleChip, visibleChips } from '../core/step-part-chips.mjs';
import type { ModelViewerState } from '../useModelViewer';

/**
 * The part the learner has chosen to look at alone, which the lesson page holds because two things choose it: the chips here and the
 * linked words in the step's text (see LinkedPart). `offered` tells the page whether the chips are on show, which is when the words
 * become tappable too: a model that cannot spotlight, or one still loading, leaves both as plain text.
 */
export type PartPick = {
  selected?: string;
  choose: (id?: string) => void;
  offered: (shown: boolean) => void;
};

type StepPartChipsProps = {
  viewer: ModelViewerState;
  pick: PartPick;
  /** The parts the lesson step spotlights. */
  stepParts?: string[];
  /** Changes when the step's view does, which folds a long row of chips again. */
  resetKey: string;
  /** Where in the page the row goes: under the step's text, which is outside the viewer. */
  slot: HTMLElement;
};

const PILL = 'inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold group-focus-visible:ring-2 group-focus-visible:ring-teal-300';

/**
 * A row of chips under a step's text, one for each part the step spotlights. Tapping a chip spotlights just that part in the 3D view;
 * tapping it again, or moving to the next step, goes back to the step's own spotlight (the lesson page forgets the choice when the step
 * changes). It is drawn into `slot` and not inside the
 * viewer so that it sits with the words it belongs to. A step that spotlights fewer than two parts, or a model that cannot spotlight,
 * gets nothing.
 */
export function StepPartChips({ viewer, pick, stepParts, resetKey, slot }: StepPartChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const { selected, choose, offered: reportOffered } = pick;
  const { previewPart } = viewer;

  // The viewer outlives this row (it stays mounted, hidden, while the learner passes a picture), so a part still being previewed when the row
  // went is handed back here when the row next appears: with nothing chosen this puts the step's own spotlight back.
  useEffect(() => { previewPart(selected); }, [selected, previewPart]);
  useEffect(() => { setExpanded(false); }, [resetKey]);

  const chips = stepPartChips(stepParts, viewer.features?.components?.items);
  const offered = Boolean(viewer.features?.focus) && chipsOffered(chips);
  useEffect(() => { reportOffered(offered); }, [offered, reportOffered]);
  useEffect(() => () => reportOffered(false), [reportOffered]);
  if (!offered) return null;

  const { shown, hidden } = visibleChips(chips, { expanded, selected });
  const chosen = chips.find((chip) => chip.id === selected);

  return createPortal(
    <div role="group" aria-label="Parts in this view" className="flex flex-col gap-1.5">
      <p role="status" className="text-xs text-slate-300">
        {chosen
          ? <>Showing <strong className="text-white">{chosen.label}</strong> alone · tap it again to show them all</>
          : <><span className="font-semibold text-slate-400">Parts in this view</span> · tap one to look at it alone</>}
      </p>
      <div className="flex flex-wrap gap-x-1.5">
        {shown.map((chip) => {
          const active = chip.id === selected;
          return <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => choose(toggleChip(selected, chip.id))}
            className="group inline-flex min-h-11 items-center outline-none"
          ><span className={`${PILL} ${active ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}>{chip.label}</span></button>;
        })}
        {hidden > 0 && <button type="button" aria-expanded={false} onClick={() => setExpanded(true)} className="group inline-flex min-h-11 items-center outline-none">
          <span className={`${PILL} border-dashed border-slate-700 text-slate-300`}>+{hidden} more</span>
        </button>}
        {expanded && chips.length > CHIPS_COLLAPSED_LIMIT && <button type="button" aria-expanded={true} onClick={() => setExpanded(false)} className="group inline-flex min-h-11 items-center outline-none">
          <span className={`${PILL} border-dashed border-slate-700 text-slate-300`}>Show fewer</span>
        </button>}
      </div>
    </div>,
    slot,
  );
}
