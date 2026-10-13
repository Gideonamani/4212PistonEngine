import React from 'react';
import { X } from 'lucide-react';
import { ControlsBody } from './controls/ControlsBody';
import { DockTabs } from './controls/DockTabs';
import type { ViewerControls } from './controls/useViewerControls';
import type { ModelViewerState } from './useModelViewer';

type ExploreControlsProps = {
  viewer: ModelViewerState;
  controls: ViewerControls;
  onClose: () => void;
};

/**
 * Explore's side panel (under the model on a phone): the model's short name and description, then the same tabs a lesson's dock offers,
 * with the open panel below. The name and description live here rather than over the model, so full screen shows the model alone.
 */
export function ExploreControls({ viewer, controls, onClose }: ExploreControlsProps) {
  const { definition } = viewer;
  return <aside className="order-2 flex max-h-[44%] min-h-60 w-full shrink-0 flex-col border-t border-teal-500/25 bg-panel text-slate-100 shadow-2xl lg:order-none lg:h-full lg:max-h-none lg:min-h-0 lg:w-80 lg:border-l lg:border-t-0" aria-label="Explore controls">
    <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-3 pb-3 pt-2.5">
      <div className="min-w-0">
        <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-teal-400">EXPLORE CONTROLS</span>
        <h2 className="mt-1 text-[15px] font-bold leading-snug tracking-tight text-white">{definition.shortLabel}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300 lg:text-[12.5px]">{definition.summary}</p>
      </div>
      <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Hide Explore controls"><X className="h-4 w-4" /></button>
    </div>

    <div className="border-b border-slate-800 p-2">
      <DockTabs viewer={viewer} panels={controls.panels} context={controls.context} open={controls.active} onSelect={controls.select} compact />
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {controls.active && <ControlsBody id={controls.active} viewer={viewer} controls={controls} />}
    </div>
  </aside>;
}
