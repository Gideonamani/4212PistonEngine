import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Expand, Focus, LoaderCircle, Maximize2, Minimize2, Move3D, RotateCcw, Shrink, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { modelsById } from '../data/modelRegistry';
import { createModelSession } from './adapters';
import { createViewerRuntime } from './core/runtime';
import { CompactMotionPlayer, ExploreControls, type ExplorePanel } from './ExploreControls';
import type { InteractionMode, ViewerProfile, ViewerSession, ViewerSnapshot } from './types';

type ModelViewerProps = {
  modelId: string;
  profile?: ViewerProfile;
  immersive?: boolean;
  initialAngle?: number;
  initialCycle?: boolean;
  viewPreset?: string;
  focusHotspots?: string[];
  onOpenExplore?: () => void;
  isFullPage?: boolean;
  isFullscreen?: boolean;
  onToggleFullPage?: () => void;
  onToggleFullscreen?: () => void;
};

export default function ModelViewer({
  modelId,
  profile = 'explore',
  immersive = false,
  initialAngle,
  initialCycle,
  viewPreset,
  focusHotspots,
  onOpenExplore,
  isFullPage = false,
  isFullscreen = false,
  onToggleFullPage,
  onToggleFullscreen,
}: ModelViewerProps) {
  const definition = modelsById[modelId];
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ReturnType<typeof createViewerRuntime> | undefined>(undefined);
  const sessionRef = useRef<ViewerSession | undefined>(undefined);
  const [loadState, setLoadState] = useState<ViewerSnapshot>({ status: 'Preparing 3D viewer…', progress: 0 });
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('orbit');
  const [panel, setPanel] = useState<ExplorePanel>('components');
  const [controlsOpen, setControlsOpen] = useState(profile === 'explore');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [showPlayerOnViewer, setShowPlayerOnViewer] = useState(() => localStorage.getItem('4212-explore-show-player') !== 'false');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !definition) return;
    const controller = new AbortController();
    const runtime = createViewerRuntime(mount);
    runtimeRef.current = runtime;
    setError('');
    setLoadState({ status: 'Preparing 3D viewer…', progress: 0 });
    if (profile === 'lesson-dynamic' || profile === 'assessment') runtime.controls.enabled = false;
    let disposed = false;
    createModelSession(definition, {
      runtime,
      profile,
      signal: controller.signal,
      initialAngle,
      initialCycle,
      viewPreset,
      focusHotspots,
      onChange: () => { if (!disposed) setVersion((value) => value + 1); },
      onProgress: (status, progress) => { if (!disposed) setLoadState({ status, progress }); },
    }).then((session) => {
      if (disposed) { session.dispose(); return; }
      sessionRef.current = session;
      setLoadState(session.snapshot());
      setVersion((value) => value + 1);
    }).catch((reason: unknown) => {
      if (disposed || controller.signal.aborted) return;
      console.error(reason);
      setError(reason instanceof Error ? reason.message : 'The 3D model could not be loaded.');
    });

    return () => {
      disposed = true;
      controller.abort();
      sessionRef.current?.dispose();
      sessionRef.current = undefined;
      runtime.dispose();
      runtimeRef.current = undefined;
    };
  }, [definition, modelId, profile, initialAngle, initialCycle, viewPreset, focusHotspots?.join('|')]);

  void version;
  const session = sessionRef.current;
  const snapshot = session?.snapshot() || loadState;
  const features = session?.features;
  const hasControlPanels = Boolean(features?.components || features?.motion || features?.section || features?.appearance);
  const activeHotspot = features?.hotspots?.items.find((hotspot) => hotspot.id === snapshot.activeHotspotId);
  const showExploreControls = profile === 'explore';
  const viewerHeight = showExploreControls
    ? 'h-full min-h-[22rem]'
    : immersive
      ? 'h-[58dvh] min-h-[22rem]'
      : 'h-[20rem] min-h-[18rem] sm:h-[24rem]';

  const filteredComponents = useMemo(() => {
    const items = features?.components?.items || [];
    const term = query.trim().toLowerCase();
    return items.filter((component) => (!group || group === 'all' || component.group === group || (group === 'cylinders' && component.group.startsWith('cylinder-')))
      && (!term || `${component.label} ${component.description}`.toLowerCase().includes(term)));
  }, [features?.components?.items, query, group]);

  if (!definition) return <div className="flex min-h-52 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-950/20 p-5 text-sm text-rose-200">Unknown 3D model: {modelId}</div>;

  const setPlayerPreference = (value: boolean) => {
    setShowPlayerOnViewer(value);
    localStorage.setItem('4212-explore-show-player', String(value));
  };

  return <section className={`relative isolate flex overflow-hidden bg-[#071418] text-slate-100 shadow-inner ${showExploreControls ? 'flex-col lg:flex-row' : ''} ${showExploreControls ? '' : 'rounded-xl border border-teal-400/20'} ${viewerHeight}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${showExploreControls && controlsOpen && hasControlPanels ? 'min-h-[18rem]' : ''}`}>
      <div
        ref={mountRef}
        role="application"
        tabIndex={0}
        aria-label={`${definition.label}. Drag to rotate, pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom, and Home resets the view.`}
        onKeyDown={(event) => {
          const runtime = runtimeRef.current;
          if (!runtime || !runtime.controls.enabled) return;
          const offset = runtime.camera.position.clone().sub(runtime.controls.target);
          if (event.key === 'Home') runtime.resetView();
          else if (event.key === '+' || event.key === '=') runtime.camera.position.copy(runtime.controls.target).add(offset.multiplyScalar(0.84));
          else if (event.key === '-') runtime.camera.position.copy(runtime.controls.target).add(offset.multiplyScalar(1.18));
          else if (event.key.startsWith('Arrow')) {
            const spherical = new THREE.Spherical().setFromVector3(offset);
            const step = Math.PI / 24;
            if (event.key === 'ArrowLeft') spherical.theta -= step;
            if (event.key === 'ArrowRight') spherical.theta += step;
            if (event.key === 'ArrowUp') spherical.phi = Math.max(0.08, spherical.phi - step);
            if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - 0.08, spherical.phi + step);
            runtime.camera.position.copy(runtime.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
          } else return;
          event.preventDefault();
          runtime.controls.update();
          runtime.render();
        }}
        className="absolute inset-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-300"
      />

      {!session && !error && <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#071418]/95 text-teal-200" role="status" aria-live="polite">
        <LoaderCircle className="h-7 w-7 animate-spin" />
        <span className="mt-2 px-4 text-center font-mono text-[10px] font-bold tracking-widest">{snapshot.status.toUpperCase()}</span>
        {snapshot.progress !== undefined && <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-teal-400 transition-[width]" style={{ width: `${snapshot.progress}%` }} /></div>}
      </div>}
      {error && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#071418] p-6 text-center text-rose-200" role="alert"><TriangleAlert className="h-7 w-7" /><p className="mt-2 max-w-sm text-xs leading-relaxed">{error}</p></div>}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-[#061216]/95 via-[#061216]/55 to-transparent p-3 pb-12">
        <div className="min-w-0 pr-2"><div className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-[0.18em] text-teal-300"><Box className="h-3.5 w-3.5" />{definition.eyebrow}</div><p className="mt-1 truncate text-[10px] text-slate-300">{runtimeRef.current?.controls.enabled === false ? 'Guided lesson pose' : interactionMode === 'pan' ? 'Drag to pan · Pinch to zoom' : 'Drag to rotate · Pinch to zoom · Two-finger drag to pan'}</p></div>
        <div className="pointer-events-auto flex shrink-0 flex-nowrap justify-end gap-1.5">
          {showExploreControls && onToggleFullPage && <button type="button" onClick={onToggleFullPage} className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg ${isFullPage ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200 hover:border-teal-400'}`} title={isFullPage ? 'Exit full-page viewer' : 'Use full-page viewer'} aria-label={isFullPage ? 'Exit full-page viewer' : 'Use full-page viewer'} aria-pressed={isFullPage}>{isFullPage ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button>}
          {showExploreControls && onToggleFullscreen && <button type="button" onClick={onToggleFullscreen} className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg ${isFullscreen ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200 hover:border-teal-400'}`} title={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} aria-label={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} aria-pressed={isFullscreen}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>}
          {runtimeRef.current?.controls.enabled !== false && <button type="button" onClick={() => { const next = interactionMode === 'pan' ? 'orbit' : 'pan'; setInteractionMode(next); runtimeRef.current?.setInteractionMode(next); }} className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg ${interactionMode === 'pan' ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200 hover:border-teal-400'}`} aria-label={interactionMode === 'pan' ? 'Return to rotate mode' : 'Pan model'} aria-pressed={interactionMode === 'pan'}><Move3D className="h-4 w-4" /></button>}
          <button type="button" onClick={() => runtimeRef.current?.resetView()} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg hover:border-teal-400" aria-label="Reset and centre 3D view"><RotateCcw className="h-4 w-4" /></button>
          {showExploreControls && hasControlPanels && <button type="button" onClick={() => setControlsOpen((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg ${controlsOpen ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200'}`} aria-label={controlsOpen ? 'Hide Explore controls' : 'Show Explore controls'} aria-pressed={controlsOpen}><SlidersHorizontal className="h-4 w-4" /></button>}
        </div>
      </div>

      {showExploreControls && features?.hotspots && <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-slate-700/80 bg-[#07161b]/94 p-2 shadow-xl backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-[calc(100%-1.5rem)]">
        <div className="flex gap-1.5 overflow-x-auto" aria-label="Guided model hotspots">{features.hotspots.items.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => features.hotspots!.focus(hotspot.id)} aria-pressed={snapshot.activeHotspotId === hotspot.id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${snapshot.activeHotspotId === hotspot.id ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}><Focus className="h-3 w-3" />{hotspot.label}</button>)}</div>
        {activeHotspot && <p className="px-1 pt-1.5 text-[10px] leading-relaxed text-slate-300"><strong className="text-white">{activeHotspot.label}:</strong> {activeHotspot.description}</p>}
      </div>}

      {showExploreControls && features?.motion && !controlsOpen && showPlayerOnViewer && <CompactMotionPlayer motion={features.motion} snapshot={snapshot} />}

      {!showExploreControls && session && <div className="absolute inset-x-2 bottom-2 z-10 rounded-xl border border-slate-700/80 bg-[#07161b]/95 p-2 shadow-xl backdrop-blur-sm sm:inset-x-3 sm:bottom-3">
        {features?.hotspots && <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Guided model hotspots">{features.hotspots.items.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => features.hotspots!.focus(hotspot.id)} aria-pressed={snapshot.activeHotspotId === hotspot.id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${snapshot.activeHotspotId === hotspot.id ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}><Focus className="h-3 w-3" />{hotspot.label}</button>)}</div>}
        {features?.motion && <div className="flex items-center gap-3"><span className="rounded-lg border border-teal-500/30 bg-teal-950/40 px-2.5 py-1.5 font-mono text-[10px] font-bold text-teal-300">POSE {Math.round(snapshot.angle ?? 0)}°</span><p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-slate-400">{snapshot.motionNote}</p></div>}
        {activeHotspot && <p className="px-1 pt-1 text-[10px] leading-relaxed text-slate-300"><strong className="text-slate-100">{activeHotspot.label}:</strong> {activeHotspot.description}</p>}
        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-800/80 px-1 pt-1.5"><span className="truncate text-[9px] text-slate-500">{definition.sourceLabel ? `${definition.sourceLabel} · ${definition.license}` : definition.label}</span>{onOpenExplore && <button type="button" onClick={onOpenExplore} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950"><Box className="h-3 w-3" />Explore fully</button>}</div>
      </div>}
    </div>

    {showExploreControls && controlsOpen && hasControlPanels && features && <ExploreControls
      definitionLabel={definition.label}
      features={features}
      snapshot={snapshot}
      panel={panel}
      onPanelChange={setPanel}
      onClose={() => setControlsOpen(false)}
      filteredComponents={filteredComponents}
      query={query}
      onQueryChange={setQuery}
      group={group}
      onGroupChange={setGroup}
      showPlayerOnViewer={showPlayerOnViewer}
      onShowPlayerOnViewerChange={setPlayerPreference}
    />}
  </section>;
}
