import React from 'react';
import { Pause, Play } from 'lucide-react';
import type { ViewerFeatures, ViewerSnapshot } from '../types';

/** The two players that float over Explore's model while its controls panel is closed. */

/** The small player that floats over the Explore model while the panel is closed. */
export function CompactMotionPlayer({ motion, snapshot }: { motion: NonNullable<ViewerFeatures['motion']>; snapshot: ViewerSnapshot }) {
  return <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-teal-500/30 bg-panel/95 p-2.5 shadow-2xl backdrop-blur sm:left-3 sm:right-auto sm:w-[28rem] sm:max-w-[calc(100%-1.5rem)]" aria-label="Crank angle player">
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={() => motion.setPlaying(!snapshot.playing)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400 text-slate-950" aria-label={snapshot.playing ? 'Pause mechanism' : 'Play mechanism'} aria-pressed={Boolean(snapshot.playing)}>{snapshot.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
      <div className="min-w-0 flex-1"><div className="mb-1 flex items-center justify-between font-mono text-[11px] font-bold tracking-wider text-slate-400"><span>CRANK ANGLE</span><output className="text-xs text-teal-300">{Math.round(snapshot.angle ?? 0)}°</output></div><input aria-label="Crank angle" type="range" min="0" max="720" step="1" value={snapshot.angle ?? 0} onChange={(event) => motion.setAngle(Number(event.target.value))} className="block w-full accent-teal-400" /></div>
    </div>
    <div className="ml-11 mt-0.5 flex justify-between font-mono text-[11px] text-slate-600" aria-hidden="true"><span>0°</span><span>180°</span><span>360°</span><span>540°</span><span>720°</span></div>
  </div>;
}

export function SavedMotionControls({ features, snapshot }: { features: ViewerFeatures; snapshot: ViewerSnapshot }) {
  const saved = features.savedMotions!;
  const active = snapshot.savedMotionId || 'operating';
  const reverse = saved.items.find(item => active === 'exploded' ? item.id === 'reassembly' : active === 'reassembly' ? item.id === 'exploded' : active === 'Exploded overview' ? item.id === 'Reassembly overview' : active === 'Reassembly overview' ? item.id === 'Exploded overview' : false);
  const stages = saved.items.find(item => item.id === active)?.stages || [];
  return <div className="space-y-2" aria-label="Saved assembly motions">
    <label className="block text-[11px] font-bold text-slate-400">MOTION<select aria-label="Saved motion" value={active} onChange={event => saved.select(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white">{saved.items.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    {active !== 'operating' && <>
      <div className="flex justify-between text-xs"><span>{snapshot.motionStage}</span><output>{Math.round(snapshot.motionProgress || 0)}%</output></div>
      <input aria-label="Assembly motion progress" type="range" min="0" max="100" step="0.1" value={snapshot.motionProgress || 0} onChange={event => saved.setProgress(Number(event.target.value))} className="w-full accent-teal-400" />
      <div className="grid grid-cols-2 gap-2"><button onClick={() => features.motion!.setPlaying(!snapshot.playing)} className="rounded-lg bg-teal-400 p-2 text-xs font-bold text-slate-950">{snapshot.playing ? 'Pause' : 'Play'}</button><button onClick={() => features.motion!.reset()} className="rounded-lg border border-slate-700 p-2 text-xs">Reset motion</button></div>
      {reverse && <button onClick={() => { const position = 100 - (snapshot.motionProgress || 0); saved.select(reverse.id); saved.setProgress(position); }} className="w-full rounded-lg border border-slate-700 p-2 text-xs">Reverse this motion</button>}
      <div className="grid grid-cols-2 gap-2"><button onClick={() => saved.step(-1)} className="rounded-lg border border-slate-700 p-2 text-xs">Previous stage</button><button onClick={() => saved.step(1)} className="rounded-lg border border-slate-700 p-2 text-xs">Next stage</button></div>
      <div className="flex flex-wrap gap-1">{stages.map(stage => <button key={stage.progress} onClick={() => saved.setProgress(stage.progress)} className="rounded border border-slate-700 px-2 py-1 text-[11px]">{stage.label}</button>)}</div>
      <p className="text-[11px] text-slate-400">Pause or drag the slider, then rotate, zoom, select or section the assembly.</p>
    </>}
  </div>;
}
