import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Eye, Focus, Layers3, LoaderCircle, Move3D, Pause, Play, RotateCcw, Search, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import { modelsById } from '../data/modelRegistry';
import { createModelSession } from './adapters';
import { createViewerRuntime } from './core/runtime';
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
};

type Panel = 'components' | 'motion' | 'section' | 'appearance';

export default function ModelViewer({
  modelId,
  profile = 'explore',
  immersive = false,
  initialAngle,
  initialCycle,
  viewPreset,
  focusHotspots,
  onOpenExplore,
}: ModelViewerProps) {
  const definition = modelsById[modelId];
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ReturnType<typeof createViewerRuntime> | undefined>(undefined);
  const sessionRef = useRef<ViewerSession | undefined>(undefined);
  const [loadState, setLoadState] = useState<ViewerSnapshot>({ status: 'Preparing 3D viewer…', progress: 0 });
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('orbit');
  const [panel, setPanel] = useState<Panel>('components');
  const [controlsOpen, setControlsOpen] = useState(profile === 'explore');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');

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

  const choosePanel = (next: Panel) => {
    setPanel(next);
    setControlsOpen(true);
  };

  return <section className={`relative isolate overflow-hidden bg-[#071418] text-slate-100 shadow-inner ${showExploreControls ? '' : 'rounded-xl border border-teal-400/20'} ${viewerHeight}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
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
        }
        else return;
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
      <div><div className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-[0.18em] text-teal-300"><Box className="h-3.5 w-3.5" />{definition.eyebrow}</div><p className="mt-1 text-[10px] text-slate-300">{runtimeRef.current?.controls.enabled === false ? 'Guided lesson pose' : interactionMode === 'pan' ? 'Drag to pan · Pinch to zoom' : 'Drag to rotate · Pinch to zoom · Two-finger drag to pan'}</p></div>
      <div className="pointer-events-auto flex gap-1.5">
        {runtimeRef.current?.controls.enabled !== false && <button type="button" onClick={() => { const next = interactionMode === 'pan' ? 'orbit' : 'pan'; setInteractionMode(next); runtimeRef.current?.setInteractionMode(next); }} className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg ${interactionMode === 'pan' ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200 hover:border-teal-400'}`} aria-label={interactionMode === 'pan' ? 'Return to rotate mode' : 'Pan model'} aria-pressed={interactionMode === 'pan'}><Move3D className="h-4 w-4" /></button>}
        <button type="button" onClick={() => runtimeRef.current?.resetView()} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg hover:border-teal-400" aria-label="Reset 3D view"><RotateCcw className="h-4 w-4" /></button>
        {showExploreControls && hasControlPanels && <button type="button" onClick={() => setControlsOpen((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg ${controlsOpen ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200'}`} aria-label={controlsOpen ? 'Hide model controls' : 'Show model controls'}><SlidersHorizontal className="h-4 w-4" /></button>}
      </div>
    </div>

    {showExploreControls && features?.hotspots && <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-slate-700/80 bg-[#07161b]/94 p-2 shadow-xl backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-[calc(100%-1.5rem)]">
      <div className="flex gap-1.5 overflow-x-auto" aria-label="Guided model hotspots">{features.hotspots.items.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => features.hotspots!.focus(hotspot.id)} aria-pressed={snapshot.activeHotspotId === hotspot.id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${snapshot.activeHotspotId === hotspot.id ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}><Focus className="h-3 w-3" />{hotspot.label}</button>)}</div>
      {activeHotspot && <p className="px-1 pt-1.5 text-[10px] leading-relaxed text-slate-300"><strong className="text-white">{activeHotspot.label}:</strong> {activeHotspot.description}</p>}
    </div>}

    {showExploreControls && hasControlPanels && features && <>
      <div className="absolute bottom-3 left-3 z-20 flex gap-1.5 rounded-xl border border-slate-700/80 bg-[#07161b]/92 p-1.5 shadow-xl backdrop-blur">
        {features.components && <button onClick={() => choosePanel('components')} className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold ${panel === 'components' && controlsOpen ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}><Box className="h-3.5 w-3.5" />Components</button>}
        {features.motion && <button onClick={() => choosePanel('motion')} className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold ${panel === 'motion' && controlsOpen ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}><Play className="h-3.5 w-3.5" />Motion</button>}
        {features.section && <button onClick={() => choosePanel('section')} className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold ${panel === 'section' && controlsOpen ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}><Layers3 className="h-3.5 w-3.5" />Inside</button>}
        {features.appearance && <button onClick={() => choosePanel('appearance')} className={`hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold sm:flex ${panel === 'appearance' && controlsOpen ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}><Eye className="h-3.5 w-3.5" />Look</button>}
      </div>

      {controlsOpen && <aside className="absolute bottom-16 left-3 right-3 z-20 max-h-[48%] overflow-y-auto rounded-2xl border border-teal-500/30 bg-[#07161b]/96 p-3 shadow-2xl backdrop-blur sm:bottom-3 sm:left-auto sm:right-3 sm:top-16 sm:max-h-none sm:w-80">
        <div className="flex items-center justify-between"><strong className="text-xs text-white">{panel === 'components' ? 'Components' : panel === 'motion' ? 'Mechanism motion' : panel === 'section' ? 'Look inside' : 'Appearance'}</strong><button onClick={() => setControlsOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close model controls"><X className="h-4 w-4" /></button></div>
        {panel === 'components' && features.components && <div className="mt-3 space-y-2.5">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components…" className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 pl-8 pr-2 text-xs outline-none focus:border-teal-400" /></div>
          <select value={group} onChange={(event) => setGroup(event.target.value)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs outline-none focus:border-teal-400">{features.components.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select value={snapshot.selectedId || ''} onChange={(event) => features.components!.select(event.target.value)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs outline-none focus:border-teal-400"><option value="">Whole assembly</option>{filteredComponents.map((component) => <option key={component.id} value={component.id}>{component.label}</option>)}</select>
          <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><strong className="text-xs text-white">{snapshot.selectedLabel || definition.label}</strong><p className="mt-1 text-[10px] leading-relaxed text-slate-400">{snapshot.selectedDescription || `${filteredComponents.length} teaching components available.`}</p></div>
          <div className="grid grid-cols-2 gap-2"><button disabled={!snapshot.selectedId} onClick={() => features.components!.isolate()} className="rounded-lg bg-teal-400 px-3 py-2 text-[10px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Isolate</button><button onClick={() => features.components!.showAll()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-200">Show all</button></div>
        </div>}
        {panel === 'motion' && features.motion && <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between"><span className="font-mono text-[10px] text-slate-400">CRANK ANGLE</span><strong className="font-mono text-sm text-teal-300">{Math.round(snapshot.angle || 0)}°</strong></div>
          <input type="range" min="0" max="720" step="1" value={snapshot.angle || 0} onChange={(event) => features.motion!.setAngle(Number(event.target.value))} className="w-full accent-teal-400" />
          <div className="grid grid-cols-2 gap-2"><button onClick={() => features.motion!.setPlaying(!snapshot.playing)} className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-400 px-3 py-2 text-[10px] font-bold text-slate-950">{snapshot.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{snapshot.playing ? 'Pause' : 'Play'}</button><button onClick={() => features.motion!.reset()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold">Reset</button></div>
          <div className="grid grid-cols-5 gap-1">{[0, 180, 360, 540, 720].map((angle) => <button key={angle} onClick={() => features.motion!.setAngle(angle)} className="rounded-md border border-slate-700 px-1 py-1 text-[9px] text-slate-300 hover:border-teal-400">{angle}°</button>)}</div>
          <p className="text-[10px] leading-relaxed text-slate-400">{snapshot.motionNote}</p>
          {features.cycleCues && <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-xs"><span><strong className="block text-white">Four-stroke cues</strong><small className="text-[10px] text-slate-500">Illustrative gas-path particles</small></span><input type="checkbox" checked={Boolean(snapshot.cycleEnabled)} onChange={(event) => features.cycleCues!.setEnabled(event.target.checked)} className="accent-teal-400" /></label>}
          {snapshot.cycleEnabled && <p className="text-[10px] leading-relaxed text-teal-200">{snapshot.cycleNote}</p>}
        </div>}
        {panel === 'section' && features.section && <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-xs"><span className="font-semibold">Enable section view</span><input type="checkbox" checked={Boolean(snapshot.sectionEnabled)} onChange={(event) => features.section!.setEnabled(event.target.checked)} className="accent-teal-400" /></label>
          <select value={snapshot.sectionAxis || 'z'} onChange={(event) => features.section!.setAxis(event.target.value as any)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs"><option value="x">Across X</option><option value="y">Across Y</option><option value="z">Across Z</option></select>
          <div><div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>Cut position</span><span>{snapshot.sectionPosition}%</span></div><input type="range" min="0" max="100" value={snapshot.sectionPosition || 50} onChange={(event) => features.section!.setPosition(Number(event.target.value))} className="w-full accent-teal-400" /></div>
          <div className="grid grid-cols-2 gap-2"><button onClick={() => features.section!.flip()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold">Reverse cut</button><button onClick={() => features.section!.reset()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold">Reset</button></div>
        </div>}
        {panel === 'appearance' && features.appearance && <div className="mt-3 space-y-2"><label className="text-[10px] font-bold text-slate-400">COLOUR TREATMENT</label><select value={snapshot.appearance || 'inspection'} onChange={(event) => features.appearance!.setMode(event.target.value as any)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs"><option value="inspection">Inspection colours</option><option value="cad">Original CAD colours</option></select></div>}
      </aside>}
    </>}

    {!showExploreControls && session && <div className="absolute inset-x-2 bottom-2 z-10 rounded-xl border border-slate-700/80 bg-[#07161b]/95 p-2 shadow-xl backdrop-blur-sm sm:inset-x-3 sm:bottom-3">
      {features?.hotspots && <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Guided model hotspots">{features.hotspots.items.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => features.hotspots!.focus(hotspot.id)} aria-pressed={snapshot.activeHotspotId === hotspot.id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${snapshot.activeHotspotId === hotspot.id ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}><Focus className="h-3 w-3" />{hotspot.label}</button>)}</div>}
      {features?.motion && <div className="flex items-center gap-3"><span className="rounded-lg border border-teal-500/30 bg-teal-950/40 px-2.5 py-1.5 font-mono text-[10px] font-bold text-teal-300">POSE {Math.round(snapshot.angle || 0)}°</span><p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-slate-400">{snapshot.motionNote}</p></div>}
      {activeHotspot && <p className="px-1 pt-1 text-[10px] leading-relaxed text-slate-300"><strong className="text-slate-100">{activeHotspot.label}:</strong> {activeHotspot.description}</p>}
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-800/80 px-1 pt-1.5"><span className="truncate text-[9px] text-slate-500">{definition.sourceLabel ? `${definition.sourceLabel} · ${definition.license}` : definition.label}</span>{onOpenExplore && <button type="button" onClick={onOpenExplore} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950"><Box className="h-3 w-3" />Explore fully</button>}</div>
    </div>}
  </section>;
}
