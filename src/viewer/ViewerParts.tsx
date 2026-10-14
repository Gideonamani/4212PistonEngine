import React from 'react';
import { Focus, LoaderCircle, Move3D, RotateCcw, TriangleAlert } from 'lucide-react';
import { WHEEL_ZOOM_HINT, viewerHint } from './core/interaction.mjs';
import { offsetAfterKey } from './core/keyboard-orbit.mjs';
import { IconButton } from '../components/ui';
import type { ModelViewerState } from './useModelViewer';

/** The pieces ExploreViewer and LessonViewer share: the canvas, its toolbar and the hotspot chips. */

export function UnknownModel({ modelId }: { modelId: string }) {
  return <div className="flex min-h-52 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-950/20 p-5 text-sm text-rose-200">Unknown 3D model: {modelId}</div>;
}

const holdingByTouch = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

/** The "how do I move this" line for the viewer's current tool and the learner's device. */
export const useViewerHint = (viewer: ModelViewerState) => viewerHint({ mode: viewer.interactionMode, touch: holdingByTouch(), wheelZoom: viewer.wheelZoom });

/**
 * The WebGL canvas with its keyboard controls and the loading and error cover. Fills its positioned parent. Both covers let clicks
 * through to the toolbar over the canvas: a model that fails to load should not also take Reset and Explore away.
 */
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
    {!session && !error && <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-stage text-teal-200" role="status" aria-live="polite">
      {definition.previewUrl && <img src={definition.previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-40" />}
      <div className="relative flex flex-col items-center">
        <LoaderCircle className="h-7 w-7 animate-spin" />
        <span className="mt-2 px-4 text-center font-mono text-[11px] font-bold tracking-widest">{snapshot.status.toUpperCase()}</span>
        {snapshot.progress !== undefined && <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-teal-400 transition-[width]" style={{ width: `${snapshot.progress}%` }} /></div>}
      </div>
    </div>}
    {error && <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-stage p-6 text-center text-rose-200" role="alert"><TriangleAlert className="h-7 w-7" /><p className="mt-2 max-w-sm text-xs leading-relaxed">{error}</p></div>}
  </>;
}

/**
 * The round tool buttons over the canvas, top right, and nothing else. The model's name and description, how to move it and any notice about
 * what is left out are in the controls panel, so the model has the whole picture and full screen shows the model alone.
 */
export function ViewerHeader({ viewer, children }: { viewer: ModelViewerState; children?: React.ReactNode }) {
  return <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-3">
    <div className="pointer-events-auto -mr-1 -mt-1 flex shrink-0 flex-nowrap justify-end">
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
    <span className="rounded-full border border-teal-400/40 bg-panel/90 px-3 py-1.5 text-[11px] font-semibold text-teal-100 shadow-lg">{WHEEL_ZOOM_HINT}</span>
  </div>;
}

/** A round tool button over the canvas. Pass `active` for a toggle (it then reports aria-pressed); omit it for a plain action. */
export function ToolbarButton({ label, title, active, onClick, children }: { label: string; title?: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <IconButton label={label} title={title} active={active} onClick={onClick}>{children}</IconButton>;
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
