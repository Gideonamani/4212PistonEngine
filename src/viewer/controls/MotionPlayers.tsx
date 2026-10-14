import React from 'react';
import { ChevronDown, Pause, Play, Repeat, RotateCcw } from 'lucide-react';
import type { ViewerFeatures, ViewerSnapshot } from '../types';

const SPEEDS = [0.25, 0.5, 1, 2];
const speedName = (speed: number) => `${speed}×`;

type MotionPlayerProps = {
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
};

/**
 * The compact 3-row motion player floating over Explore's model while the side controls panel is hidden:
 * Row 1: Motion type header (with dropdown chevron next to title if multiple motions) and progress value.
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

  const activeMotion = saved?.items.find((item) => item.id === (snapshot.savedMotionId || 'operating')) ?? saved?.items[0];
  const motionTitle = isCrank ? 'OPERATING MECHANISM' : (activeMotion?.label.toUpperCase() ?? 'MOTION');
  const reading = isCrank ? `${Math.round(angle)}°` : `${Math.round(progress)}%`;

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
    {/* ROW 1: ANIMATION TITLE & PROGRESS VALUE */}
    <div className="flex items-center justify-between gap-3 pb-1.5">
      <div className="min-w-0 flex-1">
        {saved && saved.items.length > 1 ? (
          <div className="group relative inline-flex max-w-full items-center gap-1 cursor-pointer rounded has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-300">
            <span className="truncate font-mono text-[11px] font-bold tracking-wider text-teal-300 group-hover:text-teal-200">
              {motionTitle}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-teal-400 group-hover:text-teal-300 pointer-events-none" aria-hidden="true" />
            <select
              aria-label="Motion type"
              value={snapshot.savedMotionId || 'operating'}
              onChange={(event) => saved.select(event.target.value)}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
            >
              {saved.items.map((item) => (
                <option key={item.id} value={item.id} className="bg-panel text-white">
                  {item.label.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="block truncate font-mono text-[11px] font-bold tracking-wider text-teal-300">
            {motionTitle}
          </span>
        )}
      </div>

      <output className="shrink-0 font-mono text-xs font-bold text-teal-300">{reading}</output>
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
