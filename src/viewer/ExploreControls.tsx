import React from 'react';
import { ChevronDown, Hand, X } from 'lucide-react';
import { useStoredChoice } from '../data/localChoice';
import { ControlsBody } from './controls/ControlsBody';
import { DockTabs } from './controls/DockTabs';
import type { ViewerControls } from './controls/useViewerControls';
import { useViewerHint } from './ViewerParts';
import type { ModelViewerState } from './useModelViewer';
import type { useDrawerHeight } from './useFloatingPanel';

type ExploreControlsProps = {
  viewer: ModelViewerState;
  controls: ViewerControls;
  onClose: () => void;
  showPartCard?: boolean;
  onToggleShowPartCard?: () => void;
  onOpenCycleSplit?: () => void;
  /** Under the model (below `lg`) the drawer's height can be dragged from the bar along its top edge. */
  drawerRef?: React.RefObject<HTMLElement | null>;
  drawer?: ReturnType<typeof useDrawerHeight>;
};

/** Whether the learner has folded the model's description away; remembered on this device, for every model. */
const ABOUT_KEY = '4212-explore-about';
const ABOUT_CHOICES = ['open', 'closed'] as const;

/**
 * Explore's side panel (under the model on a phone). Everything the model once carried over itself lives here: its short name and
 * description, how to move it, and any notice about what is left out. That text folds away under the name (a tap on it), so a learner who
 * wants the room for the controls can have it. The whole panel scrolls, with the tabs staying in reach at the top, so the last control of
 * any tab can be reached whatever size the screen is. Then come the same tabs a lesson's dock offers, with the open panel below.
 * Under the model, a bar along the panel's top edge drags it taller or shorter (the height is remembered on this device).
 * A model with no tabs (a scan with only a guided tour) still gets its description here.
 */
export function ExploreControls({ viewer, controls, onClose, showPartCard, onToggleShowPartCard, onOpenCycleSplit, drawerRef, drawer }: ExploreControlsProps) {
  const { definition, snapshot } = viewer;
  const hint = useViewerHint(viewer);
  const [aboutChoice, chooseAbout] = useStoredChoice<(typeof ABOUT_CHOICES)[number]>(ABOUT_KEY, ABOUT_CHOICES);
  const aboutOpen = aboutChoice !== 'closed';
  const withTabs = controls.panels.length > 0;
  const sized = drawer?.height !== undefined;
  const size = sized ? 'h-[var(--explore-controls-h)] min-h-0' : `max-h-[44%] ${withTabs ? 'min-h-60 lg:min-h-0' : ''}`;
  return <aside ref={drawerRef} style={sized ? { '--explore-controls-h': `${drawer!.height}px` } as React.CSSProperties : undefined} className={`order-2 flex w-full shrink-0 flex-col border-t border-teal-500/25 bg-panel text-slate-100 shadow-2xl lg:order-none lg:h-full lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 ${size}`} aria-label="Explore controls">
    {drawer && <div
      {...drawer.separator}
      aria-label="Resize Explore controls"
      title="Drag to make the controls taller or shorter. Arrow keys resize; Home or a double-click puts it back."
      className="group flex h-7 shrink-0 cursor-row-resize items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-300 lg:hidden"
    >
      <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-slate-600 transition-colors group-hover:bg-teal-400 group-active:bg-teal-300" />
    </div>}
    <div data-testid="explore-controls-scroll" className="flex min-h-0 flex-auto flex-col overflow-y-auto overscroll-contain">
    <div className="shrink-0 border-b border-slate-800 px-3 pt-2.5">
      <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-teal-400">EXPLORE CONTROLS</span>
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1">
          <button type="button" aria-expanded={aboutOpen} aria-controls={aboutOpen ? 'explore-about' : undefined} onClick={() => chooseAbout(aboutOpen ? 'closed' : 'open')} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left text-[15px] font-bold leading-snug tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
            <span className="min-w-0">{definition.shortLabel}</span>
            <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-slate-400 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </h2>
        <button type="button" onClick={onClose} className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300" aria-label="Hide Explore controls"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      {aboutOpen && <div id="explore-about" className="space-y-2 pb-3">
        <p className="text-xs leading-relaxed text-slate-300 lg:text-[12.5px]">{definition.summary}</p>
        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-slate-400"><Hand className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden="true" /><span>{hint}</span></p>
        {snapshot.assemblyNotice && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-100">{snapshot.assemblyNotice}</p>}
      </div>}
    </div>

    {withTabs && <div className="sticky top-0 z-10 shrink-0 bg-panel px-2">
      <DockTabs viewer={viewer} panels={controls.panels} context={controls.context} open={controls.active} onSelect={controls.select} compact />
    </div>}

    {controls.active && <div className="shrink-0 px-3 py-3">
      <ControlsBody
        id={controls.active}
        viewer={viewer}
        controls={controls}
        showPartCard={showPartCard}
        onToggleShowPartCard={onToggleShowPartCard}
        onOpenCycleSplit={onOpenCycleSplit}
      />
    </div>}
    </div>
  </aside>;
}
