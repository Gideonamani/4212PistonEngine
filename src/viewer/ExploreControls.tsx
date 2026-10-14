import React from 'react';
import { ChevronDown, Hand, X } from 'lucide-react';
import { useStoredChoice } from '../data/localChoice';
import { ControlsBody } from './controls/ControlsBody';
import { DockTabs } from './controls/DockTabs';
import type { ViewerControls } from './controls/useViewerControls';
import { useViewerHint } from './ViewerParts';
import type { ModelViewerState } from './useModelViewer';

type ExploreControlsProps = {
  viewer: ModelViewerState;
  controls: ViewerControls;
  onClose: () => void;
};

/** Whether the learner has folded the model's description away; remembered on this device, for every model. */
const ABOUT_KEY = '4212-explore-about';
const ABOUT_CHOICES = ['open', 'closed'] as const;

/**
 * Explore's side panel (under the model on a phone). Everything the model once carried over itself lives here: its short name and
 * description, how to move it, and any notice about what is left out. That text folds away under the name (a tap on it), so a learner who
 * wants the room for the controls can have it. The whole panel scrolls, with the tabs staying in reach at the top, so the last control of
 * any tab can be reached whatever size the screen is. Then come the same tabs a lesson's dock offers, with the open panel below.
 * A model with no tabs (a scan with only a guided tour) still gets its description here.
 */
export function ExploreControls({ viewer, controls, onClose }: ExploreControlsProps) {
  const { definition, snapshot } = viewer;
  const hint = useViewerHint(viewer);
  const [aboutChoice, chooseAbout] = useStoredChoice<(typeof ABOUT_CHOICES)[number]>(ABOUT_KEY, ABOUT_CHOICES);
  const aboutOpen = aboutChoice !== 'closed';
  const withTabs = controls.panels.length > 0;
  return <aside className={`order-2 flex max-h-[44%] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-teal-500/25 bg-panel text-slate-100 shadow-2xl lg:order-none lg:h-full lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 ${withTabs ? 'min-h-60 lg:min-h-0' : ''}`} aria-label="Explore controls">
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

    {withTabs && <div className="sticky top-0 z-10 shrink-0 border-b border-slate-800 bg-panel p-2">
      <DockTabs viewer={viewer} panels={controls.panels} context={controls.context} open={controls.active} onSelect={controls.select} compact />
    </div>}

    {controls.active && <div className="shrink-0 p-3">
      <ControlsBody id={controls.active} viewer={viewer} controls={controls} />
    </div>}
  </aside>;
}
