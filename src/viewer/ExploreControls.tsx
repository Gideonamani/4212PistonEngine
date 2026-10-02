import React from 'react';
import { Box, Eye, Layers3, Pause, Play, Search, X } from 'lucide-react';
import type { AppearanceMode, ModelComponent, ViewerFeatures, ViewerSnapshot } from './types';

export type ExplorePanel = 'components' | 'motion' | 'section' | 'appearance';

type ExploreControlsProps = {
  definitionLabel: string;
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
  panel: ExplorePanel;
  onPanelChange: (panel: ExplorePanel) => void;
  onClose: () => void;
  filteredComponents: ModelComponent[];
  query: string;
  onQueryChange: (value: string) => void;
  group: string;
  onGroupChange: (value: string) => void;
  showPlayerOnViewer: boolean;
  onShowPlayerOnViewerChange: (value: boolean) => void;
};

const tabClass = (active: boolean) => `flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] font-bold transition ${active ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`;

export function ExploreControls({
  definitionLabel,
  features,
  snapshot,
  panel,
  onPanelChange,
  onClose,
  filteredComponents,
  query,
  onQueryChange,
  group,
  onGroupChange,
  showPlayerOnViewer,
  onShowPlayerOnViewerChange,
}: ExploreControlsProps) {
  return <aside className="order-2 flex max-h-[44%] min-h-60 w-full shrink-0 flex-col border-t border-teal-500/25 bg-[#07161b] text-slate-100 shadow-2xl lg:order-none lg:h-full lg:max-h-none lg:min-h-0 lg:w-80 lg:border-l lg:border-t-0" aria-label="Explore controls">
    <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
      <div><span className="font-mono text-[9px] font-bold tracking-[0.18em] text-teal-400">EXPLORE CONTROLS</span><strong className="mt-0.5 block truncate text-xs text-white">{definitionLabel}</strong></div>
      <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Hide Explore controls"><X className="h-4 w-4" /></button>
    </div>

    <div className="grid grid-cols-4 gap-1 border-b border-slate-800 p-2">
      {features.components && <button type="button" aria-label="Parts" onClick={() => onPanelChange('components')} className={tabClass(panel === 'components')}><Box className="h-3.5 w-3.5" /><span className="hidden min-[380px]:inline lg:inline">Parts</span></button>}
      {features.motion && <button type="button" aria-label="Motion" onClick={() => onPanelChange('motion')} className={tabClass(panel === 'motion')}><Play className="h-3.5 w-3.5" /><span className="hidden min-[380px]:inline lg:inline">Motion</span></button>}
      {features.section && <button type="button" aria-label="Inside" onClick={() => onPanelChange('section')} className={tabClass(panel === 'section')}><Layers3 className="h-3.5 w-3.5" /><span className="hidden min-[380px]:inline lg:inline">Inside</span></button>}
      {features.appearance && <button type="button" aria-label="Look" onClick={() => onPanelChange('appearance')} className={tabClass(panel === 'appearance')}><Eye className="h-3.5 w-3.5" /><span className="hidden min-[380px]:inline lg:inline">Look</span></button>}
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {panel === 'components' && features.components && <div className="space-y-2.5">
        {features.powerPaths && <div className="space-y-2 rounded-xl border border-teal-500/30 p-3">
          <label className="block text-xs font-bold">Trace power path<select aria-label="Power path" value={snapshot.powerPathId || ''} onChange={event => features.powerPaths!.select(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs"><option value="">Choose an accessory</option>{features.powerPaths.items.map(path => <option key={path.id} value={path.id}>{path.label}</option>)}</select></label>
          <p className="text-xs leading-relaxed text-teal-100">{snapshot.powerPathNote || 'Select an accessory to highlight its mechanical path and show output rotation arrows. All geometry dimensions are illustrative.'}</p>
          <button disabled={!snapshot.powerPathId} onClick={() => features.powerPaths!.isolate()} className="min-h-11 w-full rounded-lg bg-teal-400 p-2 text-xs font-bold text-slate-950 disabled:opacity-40">Isolate complete drive path</button>
        </div>}
        <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search components…" className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 pl-8 pr-2 text-xs outline-none focus:border-teal-400" /></div>
        <select aria-label="Subassembly" value={group} onChange={(event) => onGroupChange(event.target.value)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs outline-none focus:border-teal-400">{features.components.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <select aria-label="Component" value={snapshot.selectedId || ''} onChange={(event) => features.components!.select(event.target.value)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs outline-none focus:border-teal-400"><option value="">Choose a component (optional)</option>{filteredComponents.map((component) => <option key={component.id} value={component.id}>{component.label}</option>)}</select>
        <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><strong className="text-xs text-white">{snapshot.selectedLabel || definitionLabel}</strong><p className="mt-1 text-[10px] leading-relaxed text-slate-400">{snapshot.selectedDescription || `${filteredComponents.length} teaching components available.`}</p></div>
        {features.components.isolateGroup && <button type="button" disabled={!group || group === 'all'} onClick={() => features.components!.isolateGroup!(group)} className="w-full rounded-lg bg-teal-400 px-3 py-2 text-[10px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Isolate subassembly</button>}
        <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!snapshot.selectedId} onClick={() => features.components!.isolate()} className="rounded-lg bg-teal-400 px-3 py-2 text-[10px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Isolate part</button><button type="button" onClick={() => features.components!.showAll()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-200">Show all</button></div>
      </div>}

      {panel === 'motion' && features.motion && <div className="space-y-3">
        {features.savedMotions && <SavedMotionControls features={features} snapshot={snapshot} />}

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-xs"><span><strong className="block text-white">Show player on viewer</strong><small className="text-[10px] leading-relaxed text-slate-500">Keep the motion player available when this panel is hidden.</small></span><input type="checkbox" checked={showPlayerOnViewer} onChange={(event) => onShowPlayerOnViewerChange(event.target.checked)} className="accent-teal-400" /></label>
        {(!snapshot.savedMotionId || snapshot.savedMotionId === 'operating') && <><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-slate-400">CRANK ANGLE</span><strong className="font-mono text-sm text-teal-300">{Math.round(snapshot.angle ?? 0)}°</strong></div>
        <input type="range" min="0" max="720" step="1" value={snapshot.angle ?? 0} onChange={(event) => features.motion!.setAngle(Number(event.target.value))} className="w-full accent-teal-400" />
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => features.motion!.setPlaying(!snapshot.playing)} className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-400 px-3 py-2 text-[10px] font-bold text-slate-950">{snapshot.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{snapshot.playing ? 'Pause' : 'Play'}</button><button type="button" onClick={() => features.motion!.reset()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold">Reset</button></div>
        <div className="grid grid-cols-5 gap-1">{[0, 180, 360, 540, 720].map((angle) => <button type="button" key={angle} onClick={() => features.motion!.setAngle(angle)} className="rounded-md border border-slate-700 px-1 py-1 text-[9px] text-slate-300 hover:border-teal-400">{angle}°</button>)}</div>
        </>}
        <p className="text-[10px] leading-relaxed text-slate-400">{snapshot.motionNote}</p>
        {features.cycleCues && (!snapshot.savedMotionId || snapshot.savedMotionId === 'operating') && <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-xs"><span><strong className="block text-white">Four-stroke cues</strong><small className="text-[10px] text-slate-500">Illustrative gas-path particles</small></span><input type="checkbox" checked={Boolean(snapshot.cycleEnabled)} onChange={(event) => features.cycleCues!.setEnabled(event.target.checked)} className="accent-teal-400" /></label>}
        {snapshot.cycleEnabled && (!snapshot.savedMotionId || snapshot.savedMotionId === 'operating') && <p className="text-[10px] leading-relaxed text-teal-200">{snapshot.cycleNote}</p>}
      </div>}

      {panel === 'section' && features.section && <div className="space-y-3">
        <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-xs"><span className="font-semibold">Enable section view</span><input type="checkbox" checked={Boolean(snapshot.sectionEnabled)} onChange={(event) => features.section!.setEnabled(event.target.checked)} className="accent-teal-400" /></label>
        <select value={snapshot.sectionAxis || 'z'} onChange={(event) => features.section!.setAxis(event.target.value as 'x' | 'y' | 'z')} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs"><option value="x">Across X</option><option value="y">Across Y</option><option value="z">Across Z</option></select>
        <div><div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>Cut position</span><span>{snapshot.sectionPosition ?? 50}%</span></div><input type="range" min="0" max="100" value={snapshot.sectionPosition ?? 50} onChange={(event) => features.section!.setPosition(Number(event.target.value))} className="w-full accent-teal-400" /></div>
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => features.section!.flip()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold">Reverse cut</button><button type="button" onClick={() => features.section!.reset()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold">Reset</button></div>
      </div>}

      {panel === 'appearance' && features.appearance && <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400">COLOUR TREATMENT</label><select value={snapshot.appearance || 'inspection'} onChange={(event) => features.appearance!.setMode(event.target.value as AppearanceMode)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs"><option value="inspection">Inspection colours</option><option value="cad">Original CAD colours</option></select></div>}
    </div>
  </aside>;
}

export function CompactMotionPlayer({ motion, snapshot }: { motion: NonNullable<ViewerFeatures['motion']>; snapshot: ViewerSnapshot }) {
  return <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-teal-500/30 bg-[#07161b]/95 p-2.5 shadow-2xl backdrop-blur sm:left-3 sm:right-auto sm:w-[28rem] sm:max-w-[calc(100%-1.5rem)]" aria-label="Crank angle player">
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={() => motion.setPlaying(!snapshot.playing)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400 text-slate-950" aria-label={snapshot.playing ? 'Pause mechanism' : 'Play mechanism'} aria-pressed={Boolean(snapshot.playing)}>{snapshot.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
      <div className="min-w-0 flex-1"><div className="mb-1 flex items-center justify-between font-mono text-[9px] font-bold tracking-wider text-slate-400"><span>CRANK ANGLE</span><output className="text-xs text-teal-300">{Math.round(snapshot.angle ?? 0)}°</output></div><input aria-label="Crank angle" type="range" min="0" max="720" step="1" value={snapshot.angle ?? 0} onChange={(event) => motion.setAngle(Number(event.target.value))} className="block w-full accent-teal-400" /></div>
    </div>
    <div className="ml-11 mt-0.5 flex justify-between font-mono text-[8px] text-slate-600" aria-hidden="true"><span>0°</span><span>180°</span><span>360°</span><span>540°</span><span>720°</span></div>
  </div>;
}

export function SavedMotionControls({ features, snapshot }: { features: ViewerFeatures; snapshot: ViewerSnapshot }) {
  const saved = features.savedMotions!;
  const active = snapshot.savedMotionId || 'operating';
  const reverse = saved.items.find(item => active === 'exploded' ? item.id === 'reassembly' : active === 'reassembly' ? item.id === 'exploded' : active === 'Exploded overview' ? item.id === 'Reassembly overview' : active === 'Reassembly overview' ? item.id === 'Exploded overview' : false);
  const stages = saved.items.find(item => item.id === active)?.stages || [];
  return <div className="space-y-2" aria-label="Saved assembly motions">
    <label className="block text-[10px] font-bold text-slate-400">MOTION<select aria-label="Saved motion" value={active} onChange={event => saved.select(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white">{saved.items.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    {active !== 'operating' && <>
      <div className="flex justify-between text-xs"><span>{snapshot.motionStage}</span><output>{Math.round(snapshot.motionProgress || 0)}%</output></div>
      <input aria-label="Assembly motion progress" type="range" min="0" max="100" step="0.1" value={snapshot.motionProgress || 0} onChange={event => saved.setProgress(Number(event.target.value))} className="w-full accent-teal-400" />
      <div className="grid grid-cols-2 gap-2"><button onClick={() => features.motion!.setPlaying(!snapshot.playing)} className="rounded-lg bg-teal-400 p-2 text-xs font-bold text-slate-950">{snapshot.playing ? 'Pause' : 'Play'}</button><button onClick={() => features.motion!.reset()} className="rounded-lg border border-slate-700 p-2 text-xs">Reset motion</button></div>
      {reverse && <button onClick={() => { const position = 100 - (snapshot.motionProgress || 0); saved.select(reverse.id); saved.setProgress(position); }} className="w-full rounded-lg border border-slate-700 p-2 text-xs">Reverse this motion</button>}
      <div className="grid grid-cols-2 gap-2"><button onClick={() => saved.step(-1)} className="rounded-lg border border-slate-700 p-2 text-xs">Previous stage</button><button onClick={() => saved.step(1)} className="rounded-lg border border-slate-700 p-2 text-xs">Next stage</button></div>
      <div className="flex flex-wrap gap-1">{stages.map(stage => <button key={stage.progress} onClick={() => saved.setProgress(stage.progress)} className="rounded border border-slate-700 px-2 py-1 text-[10px]">{stage.label}</button>)}</div>
      <p className="text-[10px] text-slate-400">Pause or drag the slider, then rotate, zoom, select or section the assembly.</p>
    </>}
  </div>;
}
