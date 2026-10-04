import React, { useState } from 'react';
import { Box, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { modelsById } from '../data/modelRegistry';
import { lessonProfile } from './core/view-state.mjs';
import { HotspotChips, HotspotNote, ModelCanvas, MotionStrip, ToolbarButton, UnknownModel } from './ViewerParts';
import { hasControlPanels, useControlsPanel } from './useControlsPanel';
import { useModelViewer } from './useModelViewer';
import type { ViewUpdate } from './types';

type LessonViewerProps = {
  modelId: string;
  view: ViewUpdate;
  immersive?: boolean;
  onOpenExplore?: () => void;
};

/**
 * The viewer inside a lesson step. The model gets the whole frame, with only Reset and "Explore" on top of it; everything the step
 * wants to say about the model (pose, hotspots, motion player, notices, source) sits in a strip beneath it. A model that sets
 * `lessonControls` also gets the Parts / Motion / Inside / Look panel, opened from the sliders button and shown under the strip.
 */
export default function LessonViewer({ modelId, view, immersive = false, onOpenExplore }: LessonViewerProps) {
  const definition = modelsById[modelId];
  const viewer = useModelViewer(modelId, lessonProfile(definition?.adapter), view);
  const [controlsOpen, setControlsOpen] = useState(false);
  const renderControls = useControlsPanel(viewer);
  const { features, snapshot } = viewer;
  if (!definition) return <UnknownModel modelId={modelId} />;

  const withControls = definition.lessonControls === true && hasControlPanels(viewer);
  const interactiveMotion = definition.lessonControls === true && Boolean(features?.motion);
  const canvasHeight = immersive ? 'h-[58dvh] min-h-[22rem]' : 'h-[19rem] sm:h-[22rem]';
  const credit = definition.sourceLabel ? `${definition.sourceLabel} · ${definition.license}` : definition.label;

  return <section className="overflow-hidden rounded-xl border border-teal-400/20 bg-[#071418] text-slate-100 shadow-inner" aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div className={`relative ${canvasHeight}`}>
      <ModelCanvas viewer={viewer} />
      <div className="absolute right-1 top-1 z-10 flex items-center">
        {withControls && <ToolbarButton label={controlsOpen ? 'Hide model controls' : 'Show model controls'} active={controlsOpen} onClick={() => setControlsOpen((open) => !open)}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>}
        <ToolbarButton label="Reset and centre 3D view" onClick={viewer.resetView}><RotateCcw className="h-4 w-4" /></ToolbarButton>
        {onOpenExplore && <button type="button" onClick={onOpenExplore} className="group inline-flex min-h-11 items-center px-1 outline-none"><span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal-400 px-3 text-[11px] font-bold text-slate-950 shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-white"><Box className="h-3.5 w-3.5" />Explore</span></button>}
      </div>
    </div>

    <div className="space-y-2 border-t border-slate-800/80 px-3 py-2.5">
      {snapshot.assemblyNotice && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100">{snapshot.assemblyNotice}</p>}
      {interactiveMotion
        ? <MotionStrip viewer={viewer} />
        : features?.motion && <div className="flex items-center gap-3"><span className="shrink-0 rounded-lg border border-teal-500/30 bg-teal-950/40 px-2.5 py-1.5 font-mono text-[11px] font-bold text-teal-300">POSE {Math.round(snapshot.angle ?? 0)}°</span><p className="line-clamp-2 flex-1 text-[11px] leading-snug text-slate-400">{snapshot.motionNote}</p></div>}
      <HotspotChips viewer={viewer} />
      <HotspotNote viewer={viewer} className="px-0.5" />
      <p className="truncate text-[11px] text-slate-400">Drag to rotate · pinch to zoom · {credit}</p>
    </div>

    {controlsOpen && withControls && renderControls(() => setControlsOpen(false))}
  </section>;
}
