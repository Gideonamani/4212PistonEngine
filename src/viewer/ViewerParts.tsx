import React from 'react';
import { Box, Focus, LoaderCircle, Move3D, Pause, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { DEFAULT_FOCUS_MODE, FOCUS_MODES, FOCUS_MODE_HINTS, FOCUS_MODE_LABELS } from './core/focus-style.mjs';
import { WHEEL_ZOOM_HINT, viewerHint } from './core/interaction.mjs';
import { offsetAfterKey } from './core/keyboard-orbit.mjs';
import { IconButton } from '../components/ui';
import type { FocusMode } from './types';
import type { ModelViewerState } from './useModelViewer';

/** The pieces ExploreViewer and LessonViewer share: the canvas, its toolbar and the hotspot chips. */

export function UnknownModel({ modelId }: { modelId: string }) {
  return <div className="flex min-h-52 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-950/20 p-5 text-sm text-rose-200">Unknown 3D model: {modelId}</div>;
}

const holdingByTouch = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

/** The "how do I move this" line for the viewer's current tool and the learner's device. */
export const useViewerHint = (viewer: ModelViewerState) => viewerHint({ mode: viewer.interactionMode, touch: holdingByTouch(), wheelZoom: viewer.wheelZoom });

/** The WebGL canvas with its keyboard controls and the loading and error cover. Fills its positioned parent. */
export function ModelCanvas({ viewer }: { viewer: ModelViewerState }) {
  const { definition, mountRef, runtimeRef, session, snapshot, error } = viewer;
  const onKeyDown = (event: React.KeyboardEvent) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (event.key === 'Home') runtime.resetView();
    else {
      const next = offsetAfterKey(runtime.camera.position.clone().sub(runtime.controls.target), event.key);
      if (!next) return;
      runtime.camera.position.copy(runtime.controls.target).add(next);
    }
    event.preventDefault();
    runtime.controls.update();
    runtime.render();
  };

  return <>
    <div
      ref={mountRef}
      role="application"
      tabIndex={0}
      aria-label={`${definition.label}. Drag to rotate, ${viewer.wheelZoom === 'always' ? 'pinch or scroll to zoom' : 'pinch to zoom, or hold Control and scroll'}. Arrow keys rotate, plus and minus zoom, and Home resets the view.`}
      onKeyDown={onKeyDown}
      className="absolute inset-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-300"
    />
    {!session && !error && <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-[#071418] text-teal-200" role="status" aria-live="polite">
      {definition.previewUrl && <img src={definition.previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-40" />}
      <div className="relative flex flex-col items-center">
        <LoaderCircle className="h-7 w-7 animate-spin" />
        <span className="mt-2 px-4 text-center font-mono text-[11px] font-bold tracking-widest">{snapshot.status.toUpperCase()}</span>
        {snapshot.progress !== undefined && <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-teal-400 transition-[width]" style={{ width: `${snapshot.progress}%` }} /></div>}
      </div>
    </div>}
    {error && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#071418] p-6 text-center text-rose-200" role="alert"><TriangleAlert className="h-7 w-7" /><p className="mt-2 max-w-sm text-xs leading-relaxed">{error}</p></div>}
  </>;
}

/** The title strip over the canvas: model eyebrow and hint on the left, round tool buttons on the right. */
export function ViewerHeader({ viewer, children }: { viewer: ModelViewerState; children?: React.ReactNode }) {
  const hint = useViewerHint(viewer);
  return <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-x-2 bg-gradient-to-b from-[#061216]/95 via-[#061216]/55 to-transparent p-3 pb-12">
    {/* The title takes what the 44 px buttons leave; on a very narrow screen the buttons drop below it instead of squeezing it. */}
    <div className="min-w-0 flex-1 basis-28 pr-2">
      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-[0.18em] text-teal-300"><Box className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{viewer.definition.eyebrow}</span></div>
      <p className="mt-1 truncate text-[11px] text-slate-300">{hint}</p>
    </div>
    <div className="pointer-events-auto -mr-1 -mt-1 ml-auto flex shrink-0 flex-nowrap justify-end">
      {children}
      <PanToggle viewer={viewer} />
      <ToolbarButton label="Reset and centre 3D view" onClick={viewer.resetView}><RotateCcw className="h-4 w-4" /></ToolbarButton>
    </div>
  </div>;
}

/** Switches a one-finger (or left-button) drag between rotating the model and panning it. */
export function PanToggle({ viewer }: { viewer: ModelViewerState }) {
  return <ToolbarButton label={viewer.interactionMode === 'pan' ? 'Return to rotate mode' : 'Pan model'} active={viewer.interactionMode === 'pan'} onClick={viewer.togglePan}><Move3D className="h-4 w-4" /></ToolbarButton>;
}

/** Tells a mouse user, for a moment, why the wheel scrolled the page instead of zooming the model. Only a lesson viewer ever shows it. */
export function WheelZoomHint({ viewer }: { viewer: ModelViewerState }) {
  if (!viewer.wheelHint) return null;
  return <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
    <span className="rounded-full border border-teal-400/40 bg-[#07161b]/90 px-3 py-1.5 text-[11px] font-semibold text-teal-100 shadow-lg">{WHEEL_ZOOM_HINT}</span>
  </div>;
}

/** A round tool button over the canvas. Pass `active` for a toggle (it then reports aria-pressed); omit it for a plain action. */
export function ToolbarButton({ label, title, active, onClick, children }: { label: string; title?: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <IconButton label={label} title={title} active={active} onClick={onClick}>{children}</IconButton>;
}

/**
 * Lets the learner choose how the highlighted part is drawn: coloured with the rest pale, solid with the rest as a faint ghost, or on its
 * own. It appears only while a step is spotlighting something, and shows what is actually drawn (the step's own mode until they choose).
 */
export function FocusModeSwitch({ viewer, onChoose }: { viewer: ModelViewerState; onChoose: (mode: FocusMode) => void }) {
  if (!viewer.features?.focus || !viewer.snapshot.focusActive) return null;
  const current: FocusMode = viewer.snapshot.focusMode ?? DEFAULT_FOCUS_MODE;
  return <div>
    <div role="group" aria-label="How the highlighted part is shown" className="flex items-center gap-2">
      <span aria-hidden="true" className="shrink-0 font-mono text-[11px] font-bold tracking-wider text-slate-400">SHOW</span>
      <div className="flex min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900/70 p-0.5">
        {(FOCUS_MODES as FocusMode[]).map((mode) => <button key={mode} type="button" aria-pressed={mode === current} onClick={() => onChoose(mode)} className={`min-h-11 min-w-0 flex-1 rounded-[0.65rem] px-1 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${mode === current ? 'bg-teal-400/20 text-teal-100 ring-1 ring-teal-300/70' : 'text-slate-300 hover:text-white'}`}>{FOCUS_MODE_LABELS[mode as FocusMode]}</button>)}
      </div>
    </div>
    <p className="mt-1 px-0.5 text-[11px] leading-snug text-slate-400">{FOCUS_MODE_HINTS[current]}</p>
  </div>;
}

/** The row of guided hotspot buttons, if the model has hotspots. */
export function HotspotChips({ viewer, className = '' }: { viewer: ModelViewerState; className?: string }) {
  const hotspots = viewer.features?.hotspots;
  if (!hotspots) return null;
  return <div className={`flex gap-1.5 overflow-x-auto ${className}`} aria-label="Guided model hotspots">
    {hotspots.items.map((hotspot) => {
      const active = viewer.snapshot.activeHotspotId === hotspot.id;
      return <button key={hotspot.id} type="button" onClick={() => hotspots.focus(hotspot.id)} aria-pressed={active} className="group inline-flex min-h-11 shrink-0 items-center outline-none"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold group-focus-visible:ring-2 group-focus-visible:ring-teal-300 ${active ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}><Focus className="h-3 w-3" />{hotspot.label}</span></button>;
    })}
  </div>;
}

/** The description of the hotspot the learner last chose. */
export function HotspotNote({ viewer, className = '' }: { viewer: ModelViewerState; className?: string }) {
  const active = viewer.features?.hotspots?.items.find((hotspot) => hotspot.id === viewer.snapshot.activeHotspotId);
  return active ? <p className={`text-[11px] leading-relaxed text-slate-300 ${className}`}><strong className="text-white">{active.label}:</strong> {active.description}</p> : null;
}

/**
 * A play button and scrubber that sit under the model, for a lesson. It drives the crank angle (0 to 720 degrees) for the operating
 * cylinder, or the progress of the chosen saved motion (0 to 100 per cent) for the assembly studies.
 */
export function MotionStrip({ viewer }: { viewer: ModelViewerState }) {
  const { features, snapshot } = viewer;
  const motion = features?.motion;
  if (!motion) return null;
  const saved = Boolean(features?.savedMotions) && snapshot.savedMotionId !== 'operating';
  const value = saved ? snapshot.motionProgress ?? 0 : snapshot.angle ?? 0;
  const label = saved ? snapshot.motionStage || 'Motion' : 'Crank angle';
  const readout = saved ? `${Math.round(value)}%` : `${Math.round(value)}°`;
  return <div className="flex items-center gap-2.5" aria-label="Motion player">
    <IconButton tone="primary" label={snapshot.playing ? 'Pause motion' : 'Play motion'} active={Boolean(snapshot.playing)} onClick={() => motion.setPlaying(!snapshot.playing)} className="-ml-1">{snapshot.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</IconButton>
    <div className="min-w-0 flex-1">
      <div className="mb-0.5 flex items-center justify-between gap-2 font-mono text-[11px] font-bold tracking-wider text-slate-400"><span className="truncate uppercase">{label}</span><output className="shrink-0 text-xs text-teal-300">{readout}</output></div>
      <input aria-label={saved ? 'Motion progress' : 'Crank angle'} type="range" min="0" max={saved ? 100 : 720} step={saved ? 0.1 : 1} value={value} onChange={(event) => saved ? features!.savedMotions!.setProgress(Number(event.target.value)) : motion.setAngle(Number(event.target.value))} className="block w-full accent-teal-400" />
    </div>
  </div>;
}
