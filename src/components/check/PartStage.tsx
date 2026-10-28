import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, RotateCcw, Undo2, type LucideIcon } from 'lucide-react';
import { stepPart, stepPosition } from '../../viewer/core/part-visibility.mjs';
import { ModelCanvas, PanToggle, ToolbarButton, WheelZoomHint, useViewerHint } from '../../viewer/ViewerParts';
import type { ModelViewerState } from '../../viewer/useModelViewer';

type PartStageProps = {
  viewer: ModelViewerState;
  /** A taller model for a screen that is mostly the model (the 3D part quiz). */
  tall?: boolean;
};

const tool = 'flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-40';

const ToolButton = ({ icon: Icon, label, onClick, disabled, className = '' }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; className?: string }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={`${tool} border-slate-600/70 bg-slate-900/70 text-slate-200 enabled:hover:border-teal-400 ${className}`}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span>
  </button>
);

/**
 * The model a learner taps in a part quiz, and the means to look beneath it: tap a part, hide it, and what lay under it shows. Hidden parts
 * come back one hide at a time (Undo) or all at once (Show all). No list of part names is offered, because finding a part by looking at the
 * assembly is what the quiz asks; a keyboard user steps from part to part and is told only the place in the sequence, never a name.
 */
export function PartStage({ viewer, tall = false }: PartStageProps) {
  const hint = useViewerHint(viewer);
  const components = viewer.features?.components;
  const hiddenIds = viewer.snapshot.hiddenIds ?? [];
  const selectedId = viewer.snapshot.selectedId;
  const canHide = Boolean(components?.hide);
  const ids = useMemo(() => components?.items.map((item) => item.id) ?? [], [components]);
  const isHidden = (id: string) => hiddenIds.includes(id);
  const { position, total } = stepPosition(ids, isHidden, selectedId);
  const step = (direction: 1 | -1) => {
    const next = stepPart(ids, isHidden, selectedId, direction);
    if (next) components?.select(next);
  };
  const hiddenNote = hiddenIds.length ? `${hiddenIds.length} ${hiddenIds.length === 1 ? 'part' : 'parts'} hidden` : 'Nothing hidden';

  return <div className="flex flex-col gap-2.5">
    <section className="overflow-hidden rounded-xl border border-teal-400/20 bg-stage" aria-label={`Interactive 3D model of ${viewer.definition?.label}: tap the part`}>
      <div className={`relative ${tall ? 'h-[min(56vh,28rem)]' : 'h-[min(58vh,22rem)]'}`}>
        <ModelCanvas viewer={viewer} />
        <div className="absolute right-1 top-1 z-10 flex items-center">
          <PanToggle viewer={viewer} />
          <ToolbarButton label="Reset and centre 3D view" onClick={viewer.resetView}><RotateCcw className="h-4 w-4" /></ToolbarButton>
        </div>
        <WheelZoomHint viewer={viewer} />
      </div>
      <p className="truncate border-t border-slate-800/80 px-3 py-2 text-[11px] text-slate-400">{hint}</p>
    </section>
    {canHide && <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Look beneath the parts">
        <ToolButton icon={EyeOff} label="Hide part" disabled={!selectedId} onClick={() => selectedId && components?.hide?.([selectedId])} />
        <ToolButton icon={Undo2} label="Undo" disabled={!hiddenIds.length} onClick={() => components?.undoHide?.()} />
        <ToolButton icon={Eye} label="Show all" disabled={!hiddenIds.length && !viewer.snapshot.focusActive} onClick={() => (viewer.snapshot.focusActive ? components?.showAll() : components?.showHidden?.())} />
      </div>
      <p aria-live="polite" className="text-[11px] leading-snug text-slate-400">{hiddenNote}. {selectedId ? 'Hide the highlighted part to see what lies under it.' : 'Tap a part, then hide it to see what lies under it.'}</p>
    </div>}
    <details className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
      <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-slate-200">Cannot tap the model? Step through the parts</summary>
      <div className="flex items-center gap-2 pb-1">
        <ToolButton icon={ChevronLeft} label="Previous" className="w-28" disabled={!total} onClick={() => step(-1)} />
        <span aria-live="polite" className="min-w-0 flex-1 text-center font-mono text-[11px] text-slate-300">{position ? `Part ${position} of ${total}` : `${total} parts`}</span>
        <ToolButton icon={ChevronRight} label="Next" className="w-28" disabled={!total} onClick={() => step(1)} />
      </div>
      <p className="pb-1 text-[11px] leading-snug text-slate-400">Each press highlights the next part on the model. Its name is shown after you verify.</p>
    </details>
  </div>;
}
