import React, { useState } from 'react';
import { Box, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { modelsById } from '../data/modelRegistry';
import { FOCUS_MODES } from './core/focus-style.mjs';
import { lessonProfile, viewKey } from './core/view-state.mjs';
import { useStoredChoice } from '../data/localChoice';
import { LessonDock } from './controls/LessonDock';
import { StepPartChips } from './controls/StepPartChips';
import { useViewerControls } from './controls/useViewerControls';
import { HotspotChips, HotspotNote, ModelCanvas, PanToggle, ToolbarButton, UnknownModel, WheelZoomHint, useViewerHint } from './ViewerParts';
import { useModelViewer } from './useModelViewer';
import type { FocusMode, ViewUpdate } from './types';

/** Where the learner's own choice of spotlight style is remembered on this device. */
const FOCUS_CHOICE_KEY = '4212-lesson-focus-mode';

type LessonViewerProps = {
  modelId: string;
  view: ViewUpdate;
  immersive?: boolean;
  /** 'stacked' (the default) is a canvas of limited height above the text; 'side' fills the height of its own column. */
  layout?: 'stacked' | 'side';
  onOpenExplore?: () => void;
  /** Where the lesson wants the part chips (under the step's text). Without one, or while the step is not showing this model, there are none. */
  chipSlot?: HTMLElement | null;
};

/**
 * The viewer inside a lesson step. The model gets the whole frame, with only the tools and "Explore" on top of it. Under it sits the
 * dock of tabs (Motion when the model moves; Spotlight and Section on a step that uses them; a model that sets `lessonControls` adds
 * Parts and Look, and lets the learner move the motion instead of only reading the pose), which the sliders button shows or hides, and
 * then a strip with everything else the step has to say (hotspots, notices, source).
 */
export default function LessonViewer({ modelId, view, immersive = false, layout = 'stacked', onOpenExplore, chipSlot }: LessonViewerProps) {
  const definition = modelsById[modelId];
  const [focusChoice, chooseFocusMode] = useStoredChoice<FocusMode>(FOCUS_CHOICE_KEY, FOCUS_MODES as FocusMode[]);
  const viewer = useModelViewer(modelId, lessonProfile(definition?.adapter), view, focusChoice);
  const [dockShown, setDockShown] = useState(true);
  const controls = useViewerControls(viewer, { host: 'lesson', lessonControls: definition?.lessonControls === true, chooseFocusMode });
  const hint = useViewerHint(viewer);
  const { features, snapshot } = viewer;
  if (!definition) return <UnknownModel modelId={modelId} />;

  const withDock = controls.panels.length > 0;
  const side = layout === 'side';
  // Stacked, the height is a share of the lesson's scroll area (index.css); side by side the canvas takes what the strip leaves.
  const canvasSize = side ? 'min-h-40 flex-1' : immersive ? 'lesson-viewer-stacked-immersive' : 'lesson-viewer-stacked';
  const credit = definition.sourceLabel ? `${definition.sourceLabel} · ${definition.license}` : definition.label;

  return <section className={`overflow-hidden rounded-xl border border-teal-400/20 bg-stage text-slate-100 shadow-inner ${side ? 'flex h-full flex-col' : ''}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div className={`relative ${canvasSize}`}>
      <ModelCanvas viewer={viewer} />
      <div className="absolute right-1 top-1 z-10 flex items-center">
        <PanToggle viewer={viewer} />
        <ToolbarButton label="Reset and centre 3D view" onClick={viewer.resetView}><RotateCcw className="h-4 w-4" /></ToolbarButton>
        {withDock && <ToolbarButton label={dockShown ? 'Hide model controls' : 'Show model controls'} active={dockShown} onClick={() => setDockShown((shown) => !shown)}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>}
        {onOpenExplore && <button type="button" onClick={onOpenExplore} className="group inline-flex min-h-11 items-center px-1 outline-none"><span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal-400 px-3 text-[11px] font-bold text-slate-950 shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-white"><Box className="h-3.5 w-3.5" />Explore</span></button>}
      </div>
      <WheelZoomHint viewer={viewer} />
    </div>

    {/* Side by side the dock and the strip take only the height they need, up to a share of the column, and scroll beyond it. */}
    <div className={side ? `shrink-0 overflow-y-auto ${controls.active && dockShown ? 'max-h-[70%]' : 'max-h-[48%]'}` : ''}>
      {dockShown && <LessonDock viewer={viewer} controls={controls} />}
      <div className="space-y-2 border-t border-slate-800/80 px-3 py-2.5">
        {snapshot.assemblyNotice && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100">{snapshot.assemblyNotice}</p>}
        <HotspotChips viewer={viewer} />
        <HotspotNote viewer={viewer} className="px-0.5" />
        <p className="truncate text-[11px] text-slate-400">{hint} · {credit}</p>
      </div>
    </div>
    {chipSlot && <StepPartChips viewer={viewer} stepParts={view.focusParts} resetKey={viewKey(view)} slot={chipSlot} />}
  </section>;
}
