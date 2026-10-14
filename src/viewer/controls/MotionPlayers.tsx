import React from 'react';
import { Pause, Play, Repeat, RotateCcw } from 'lucide-react';
import type { ViewerFeatures, ViewerSnapshot } from '../types';

const SPEEDS = [0.25, 0.5, 1, 2];
const speedName = (speed: number) => `${speed}×`;

type Stroke = { label: string; start: number; end: number };
const strokeAt = (strokes: Stroke[] | undefined, angle: number) =>
  strokes?.find((stroke) => angle >= stroke.start && angle < stroke.end) ?? strokes?.[strokes.length - 1];

type MotionPlayerProps = {
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
};

/**
 * The compact 3-row motion player floating over Explore's model while the side controls panel is hidden:
 * Row 1: Motion type header (or switcher if multiple motions) and live stage/angle reading.
 * Row 2: Completion status scrubber slider with milestone ticks.
 * Row 3: Action controls on a single line: Reset, Play/Pause hero, Loop toggle, and Speed in-place toggle.
 */
export function CompactMotionPlayer({ features, snapshot }: MotionPlayerProps) {
  const motion = features.motion;
  if (!motion) return null;

  const saved = features.savedMotions;
  const isCrank = !saved || !snapshot.savedMotionId || snapshot.savedMotionId === 'operating';
  const angle = snapshot.angle ?? 0;
  const progress = snapshot.motionProgress ?? 0;
  const playing = Boolean(snapshot.playing);
  const loop = Boolean(snapshot.motionLoop);
  const speed = snapshot.motionSpeed ?? 1;

  const stroke = strokeAt(motion.strokes, angle);
  const reading = isCrank ? `${Math.round(angle)}°` : `${Math.round(progress)}%`;
  const stageName = isCrank ? stroke?.label : snapshot.motionStage;

  const cycleSpeed = () => {
    if (!motion.setSpeed) return;
    const current = snapshot.motionSpeed ?? 1;
    const idx = SPEEDS.indexOf(current);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    motion.setSpeed(next);
  };

  const reset = () => {
    motion.reset();
    if (!isCrank && saved) saved.setProgress(0);
  };

  return <div
    className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/10 bg-panel/95 p-3.5 shadow-2xl backdrop-blur-md sm:left-3 sm:right-auto sm:w-[22.5rem] sm:max-w-[calc(100%-1.5rem)]"
    aria-label="Floating motion player"
  >
    {/* ROW 1: TYPE OF MOTION & STATUS READOUT */}
    <div className="flex items-center justify-between gap-2 pb-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-teal-400" aria-hidden="true" />
        {saved && saved.items.length > 1 ? (
          <select
            aria-label="Motion type"
            value={snapshot.savedMotionId || 'operating'}
            onChange={(event) => saved.select(event.target.value)}
            className="cursor-pointer truncate bg-transparent font-mono text-[11px] font-bold tracking-wider text-teal-300 outline-none hover:text-teal-200"
          >
            {saved.items.map((item) => (
              <option key={item.id} value={item.id} className="bg-panel text-white">
                {item.label.toUpperCase()}
              </option>
            ))}
          </select>
        ) : (
          <span className="truncate font-mono text-[11px] font-bold tracking-wider text-teal-300">
            {isCrank ? 'OPERATING MECHANISM' : (saved?.items[0]?.label.toUpperCase() ?? 'MOTION')}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
        {stageName && <span className="text-[11px] font-medium text-slate-400">{stageName}</span>}
        <output className="font-mono font-bold text-teal-300">{reading}</output>
      </div>
    </div>

    {/* ROW 2: SCRUBBER SLIDER */}
    <div className="py-1">
      <input
        aria-label={isCrank ? 'Crank angle' : 'Assembly motion progress'}
        type="range"
        min="0"
        max={isCrank ? 720 : 100}
        step={isCrank ? 1 : 0.1}
        value={isCrank ? angle : progress}
        onChange={(event) => (isCrank ? motion.setAngle(Number(event.target.value)) : saved?.setProgress(Number(event.target.value)))}
        className="block h-10 w-full accent-teal-400 cursor-pointer"
      />
      <div className="flex justify-between font-mono text-[10px] text-slate-400 select-none px-0.5 -mt-1" aria-hidden="true">
        {isCrank ? (
          <><span>0°</span><span>180°</span><span>360°</span><span>540°</span><span>720°</span></>
        ) : (
          <><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></>
        )}
      </div>
    </div>

    {/* ROW 3: PLAYER BUTTONS */}
    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10">
      <button
        type="button"
        aria-label="Reset motion to start"
        title="Reset motion to start"
        onClick={reset}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => motion.setPlaying(!playing)}
        aria-label={playing ? 'Pause mechanism' : 'Play mechanism'}
        aria-pressed={playing}
        className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-400 hover:bg-teal-300 active:scale-[0.98] text-xs font-bold text-slate-950 shadow-md shadow-teal-400/20 transition-all outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        {playing ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>

      {motion.setLoop && (
        <button
          type="button"
          role="switch"
          aria-checked={loop}
          aria-label="Loop playback"
          title="Loop playback"
          onClick={() => motion.setLoop!(!loop)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${loop ? 'bg-teal-400/20 text-teal-200 font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Repeat className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {motion.setSpeed && (
        <button
          type="button"
          aria-label={`Playback speed: ${speedName(speed)}. Tap to cycle speed.`}
          title="Tap to cycle playback speed"
          onClick={cycleSpeed}
          className="flex h-11 min-w-[3.25rem] px-2 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-xs font-mono font-bold text-slate-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <span>{speedName(speed)}</span>
        </button>
      )}
    </div>
  </div>;
}
