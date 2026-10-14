import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play, Repeat, RotateCcw } from 'lucide-react';
import type { ViewerFeatures, ViewerSnapshot } from '../types';
import type { PanelHost } from './panels';

export type PlayerPreference = { show: boolean; onChange: (value: boolean) => void };

const SPEEDS = [0.25, 0.5, 1, 2];
const speedName = (speed: number) => `${speed}×`;

/** One thing the Motion tab can show: the crank going round, or one of the model's saved motions (exploded, reassembly, a clip). */
type MotionPage = { id: string; label: string; crank: boolean; stages: { label: string; progress: number }[] };

/** The pages a model offers, in the order the pager walks them. A model with no saved motions has the crank alone. */
export const motionPages = (features: ViewerFeatures): MotionPage[] => {
  const saved = features.savedMotions?.items;
  if (!saved?.length) return [{ id: 'operating', label: 'Crank mechanism', crank: true, stages: [] }];
  return saved.map((item) => ({ id: item.id, label: item.label, crank: item.id === 'operating', stages: item.stages }));
};

type Stroke = { label: string; start: number; end: number };
const strokeAt = (strokes: Stroke[] | undefined, angle: number) => strokes?.find((stroke) => angle >= stroke.start && angle < stroke.end) ?? strokes?.[strokes.length - 1];

// The control row is one line when the card is wide enough for all four (17.5 rem), and otherwise Play on a line of its own over the other three, so no button is squeezed below a finger's width. (Class names are written out: Tailwind reads them as plain text.)
const iconButton = 'flex h-12 flex-1 items-center @min-[17.5rem]:flex-none justify-center rounded-2xl border border-white/15 text-slate-300 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-teal-300';
const ghostButton = 'min-h-11 rounded-xl border border-white/15 px-3 text-xs font-bold text-slate-200 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-teal-300';

type MotionPanelProps = {
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
  host: PanelHost;
  player?: PlayerPreference;
};

/**
 * The Motion card: a reading and a scrubber for the crank (its track split into the four strokes) or for a saved motion (its stages),
 * and four controls: Reset, Play or Pause (or Replay), Loop and Speed. Anything longer than a reading sits behind a Details row, in full.
 * A model with more than one motion (the crank, then exploded, then reassembly) gets a pager under the card. In a lesson the model opens at
 * the step's own pose and the learner may move it from there; Reset returns to that pose, so the card never has to say "pose".
 */
export function MotionPanel({ features, snapshot, host, player }: MotionPanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(host === 'explore');
  const [speedOpen, setSpeedOpen] = useState(false);
  const motion = features.motion;
  if (!motion) return null;

  const pages = motionPages(features);
  const activeId = snapshot.savedMotionId || 'operating';
  const index = Math.max(0, pages.findIndex((candidate) => candidate.id === activeId));
  const page = pages[index];
  const saved = features.savedMotions;
  const angle = snapshot.angle ?? 0;
  const progress = snapshot.motionProgress ?? 0;
  const playing = Boolean(snapshot.playing);
  const loop = Boolean(snapshot.motionLoop);
  const speed = snapshot.motionSpeed ?? 1;

  const stroke = strokeAt(motion.strokes, angle);
  const reading = page.crank ? `${Math.round(angle)}°` : `${Math.round(progress)}%`;
  const eyebrow = page.crank ? 'CRANK ANGLE' : page.label.toUpperCase();
  const headline = page.crank ? stroke ? `${stroke.label} stroke` : 'Crank position' : snapshot.motionStage || page.label;
  const atEnd = page.crank ? angle >= 719 : progress >= 100;
  const playLabel = playing ? 'Pause' : atEnd && !loop ? 'Replay' : 'Play';
  const reverse = saved?.items.find((item) => page.id === 'exploded' ? item.id === 'reassembly' : page.id === 'reassembly' ? item.id === 'exploded' : page.id === 'Exploded overview' ? item.id === 'Reassembly overview' : page.id === 'Reassembly overview' ? item.id === 'Exploded overview' : false);

  const goTo = (target: number) => {
    const next = pages[(target + pages.length) % pages.length];
    setSpeedOpen(false);
    if (saved) saved.select(next.id);
  };

  return <div className="space-y-2.5">
    <div className="rounded-[1.25rem] border border-white/15 bg-slate-950/40 p-3.5 pb-1.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-slate-400">{eyebrow}</div>
          <div className="mt-0.5 text-base font-extrabold leading-tight tracking-tight text-white">{headline}</div>
        </div>
        {/* Decorative: the scrubber and the tab already say the value, and an output element would be announced as a status on every change. */}
        <div aria-hidden="true" className="shrink-0 font-mono text-[26px] font-bold leading-none text-amber-300">{reading.slice(0, -1)}<span className="text-base font-medium">{reading.slice(-1)}</span></div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          aria-label={page.crank ? 'Crank angle' : 'Motion progress'}
          min="0"
          max={page.crank ? 720 : 100}
          step={page.crank ? 1 : 0.1}
          value={page.crank ? angle : progress}
          onChange={(event) => page.crank ? motion.setAngle(Number(event.target.value)) : saved?.setProgress(Number(event.target.value))}
          className="block h-11 w-full accent-teal-400"
        />
        {page.crank && motion.strokes && <div aria-hidden="true" style={{ gridTemplateColumns: `repeat(${motion.strokes.length}, minmax(0, 1fr))` }} className="grid">
          {motion.strokes.map((item) => <span key={item.label} className={`truncate text-center text-[11px] ${item === stroke ? 'font-bold text-teal-300' : 'font-medium text-slate-400'}`}>{item.label}</span>)}
        </div>}
        {!page.crank && page.stages.length > 0 && <div className="flex flex-wrap gap-1.5">
          {page.stages.map((stage) => <button key={stage.progress} type="button" onClick={() => saved?.setProgress(stage.progress)} className={`min-h-11 rounded-xl border px-3 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${snapshot.motionStage === stage.label ? 'border-teal-300/60 bg-teal-400/15 text-teal-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}>{stage.label}</button>)}
        </div>}
      </div>

      <div className="@container mt-3.5"><div className="flex flex-wrap items-center gap-2 @min-[17.5rem]:flex-nowrap">
        <button type="button" aria-label="Reset motion to the start" onClick={() => motion.reset()} className={`${iconButton} min-w-12`}><RotateCcw className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" onClick={() => motion.setPlaying(!playing)} className="order-first flex h-12 min-w-0 basis-full items-center justify-center gap-2.5 rounded-2xl bg-teal-400 text-[15px] @min-[17.5rem]:order-none @min-[17.5rem]:flex-1 @min-[17.5rem]:basis-0 font-bold text-slate-950 shadow-lg shadow-teal-400/20 outline-none focus-visible:ring-2 focus-visible:ring-white">
          {playing ? <Pause className="h-[18px] w-[18px]" aria-hidden="true" /> : <Play className="h-[18px] w-[18px]" aria-hidden="true" />}{playLabel}
        </button>
        {motion.setLoop && <button type="button" role="switch" aria-checked={loop} aria-label="Loop" onClick={() => motion.setLoop!(!loop)} className={`${iconButton} min-w-12 ${loop ? 'border-teal-300/60 bg-teal-400/15 text-teal-200' : ''}`}><Repeat className="h-5 w-5" aria-hidden="true" /></button>}
        {motion.setSpeed && <button type="button" aria-expanded={speedOpen} aria-label={`Speed ${speedName(speed)}`} onClick={() => setSpeedOpen((open) => !open)} className={`${iconButton} min-w-16 px-3 text-sm font-bold ${speedOpen ? 'border-teal-300/60 bg-teal-400/15 text-white' : 'text-white'}`}>{speedName(speed)}</button>}
      </div></div>
      {speedOpen && motion.setSpeed && <div role="radiogroup" aria-label="Playback speed" className="mt-2 grid grid-cols-4 gap-1.5">
        {SPEEDS.map((choice) => <button key={choice} type="button" role="radio" aria-checked={choice === speed} onClick={() => { motion.setSpeed!(choice); setSpeedOpen(false); }} className={`h-11 rounded-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${choice === speed ? 'bg-teal-400 font-extrabold text-slate-950' : 'border border-white/15 font-semibold text-slate-300 hover:bg-white/5'}`}>{speedName(choice)}</button>)}
      </div>}

      <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)} className="mt-2.5 flex h-11 w-full items-center justify-between border-t border-white/10 px-0.5 text-[13px] font-semibold text-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
        <span>Details</span><ChevronDown className={`h-[18px] w-[18px] transition-transform ${detailsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {detailsOpen && <div className="space-y-2.5 pb-2.5">
        <p className="text-xs leading-relaxed text-slate-300">{snapshot.motionNote}</p>
        {page.crank && features.cycleCues && <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-xs"><span><strong className="block text-white">Four-stroke cues</strong><small className="text-[11px] text-slate-400">Illustrative gas-path particles</small></span><input type="checkbox" checked={Boolean(snapshot.cycleEnabled)} onChange={(event) => features.cycleCues!.setEnabled(event.target.checked)} className="h-5 w-5 accent-teal-400" /></label>}
        {page.crank && snapshot.cycleEnabled && <p className="text-[11px] leading-relaxed text-teal-200">{snapshot.cycleNote}</p>}
        {!page.crank && saved && <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => saved.step(-1)} className={ghostButton}>Previous stage</button>
          <button type="button" onClick={() => saved.step(1)} className={ghostButton}>Next stage</button>
          {reverse && <button type="button" onClick={() => { const position = 100 - progress; saved.select(reverse.id); saved.setProgress(position); }} className={`${ghostButton} col-span-2`}>Reverse this motion</button>}
        </div>}
        {player && <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-xs"><span><strong className="block text-white">Show player on viewer</strong><small className="text-[11px] leading-relaxed text-slate-400">Keep the motion player available when this panel is hidden.</small></span><input type="checkbox" checked={player.show} onChange={(event) => player.onChange(event.target.checked)} className="h-5 w-5 accent-teal-400" /></label>}
      </div>}
    </div>

    {pages.length > 1 && <div className="flex items-center justify-between gap-2" role="group" aria-label="Animations">
      <button type="button" aria-label="Previous animation" onClick={() => goTo(index - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-slate-200 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-teal-300"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
      <div className="min-w-0 text-center">
        <div className="text-xs font-semibold text-slate-300" aria-live="polite">Animation {index + 1} of {pages.length}</div>
        <div aria-hidden="true" className="mt-1.5 flex justify-center gap-1.5">{pages.map((item) => <span key={item.id} className={`h-1.5 rounded-full ${item.id === page.id ? 'w-4 bg-teal-300' : 'w-1.5 bg-slate-600'}`} />)}</div>
      </div>
      <button type="button" aria-label="Next animation" onClick={() => goTo(index + 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-slate-200 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-teal-300"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
    </div>}
  </div>;
}
