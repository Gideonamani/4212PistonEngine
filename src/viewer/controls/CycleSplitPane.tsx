import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import type { ViewerFeatures, ViewerSnapshot } from '../types';
import { OttoCharts, useOttoData, type CycleMode, type PlotView } from './OttoCycleCard';

const SPEEDS = [0.25, 0.5, 1, 2];

type CycleSplitPaneProps = {
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
  onExit: () => void;
};

/**
 * Option A — Dedicated "Cycle Split" cockpit.
 * Portrait: sits cleanly in the bottom ~48% under an unobstructed 3D cylinder.
 * Landscape / Desktop: sits in the right ~46% side-by-side with the 3D cylinder.
 * Shows P–V and T–s side-by-side, Ideal/Practical & Ghost/Cut/Solid toggles, and a pinned 1-row crank player.
 */
export function CycleSplitPane({ features, snapshot, onExit }: CycleSplitPaneProps) {
  const [plotView, setPlotView] = useState<PlotView>('both');
  const motion = features.motion;
  const cycleCues = features.cycleCues;
  const angle = snapshot.angle ?? 0;
  const cycleType = snapshot.cycleType ?? 'otto';
  const maxAngle = cycleType === 'two-stroke' ? 360 : 720;
  const mode: CycleMode = snapshot.cycleMode ?? 'ideal';
  const reveal = snapshot.cycleReveal ?? 'ghost';
  const playing = Boolean(snapshot.playing);
  const speed = snapshot.motionSpeed ?? 1;
  const { live, workPct } = useOttoData(angle, mode, cycleType);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  if (!motion || !cycleCues) return null;

  const seekAngle = (nextAngle: number) => (cycleCues.seekAngle ?? motion.setAngle)(nextAngle);
  const firingOrder = snapshot.cycleFiringOrder;
  const heroCylinder = firingOrder?.find((item) => item.id === snapshot.cycleHeroCylinderId);

  const cycleSpeed = () => {
    if (!motion.setSpeed) return;
    const idx = SPEEDS.indexOf(speed);
    motion.setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  };

  return <aside
    aria-label="Cycle split view"
    className="flex min-h-0 min-w-0 flex-[48] flex-col border-t border-teal-500/30 bg-panel text-slate-100 shadow-2xl landscape:flex-[46] landscape:border-l landscape:border-t-0 lg:flex-[44] lg:border-l lg:border-t-0"
  >
    {/* Row 1: Compact mode / reveal / view controls + Exit */}
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-white/10 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-label={cycleType === 'diesel' ? 'Diesel cycle model' : cycleType === 'two-stroke' ? '2-stroke cycle model' : 'Otto cycle model'} className="grid grid-cols-2 gap-0.5 rounded-lg bg-slate-950/60 p-0.5">
          {(['ideal', 'practical'] as CycleMode[]).map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={mode === item}
              onClick={() => cycleCues.setMode?.(item)}
              className={`min-h-8 rounded-md px-2 text-[11px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${mode === item ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}
            >
              {item === 'ideal' ? 'Ideal' : 'Practical'}
            </button>
          ))}
        </div>

        {cycleCues.setReveal && (
          <div role="radiogroup" aria-label="Cylinder wall reveal" className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-950/60 p-0.5">
            {([
              ['ghost', 'Ghost'],
              ['section', 'Cut'],
              ['solid', 'Solid'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={reveal === id}
                onClick={() => cycleCues.setReveal!(id)}
                className={`min-h-8 rounded-md px-1.5 text-[11px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${reveal === id ? 'bg-teal-400/20 text-teal-200 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div role="group" aria-label="Chart display" className="hidden sm:flex items-center gap-0.5 rounded-lg bg-slate-950/60 p-0.5">
          {(['both', 'pv', 'ts'] as PlotView[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={plotView === v}
              onClick={() => setPlotView(v)}
              className={`min-h-8 rounded-md px-1.5 text-[10px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${plotView === v ? 'bg-white/15 text-teal-200' : 'text-slate-400 hover:text-white'}`}
            >
              {v === 'both' ? 'Both' : v === 'pv' ? 'P–V' : 'T–s'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit Cycle Split view"
          title="Exit Cycle Split view"
          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <span className="hidden xs:inline sm:inline">Exit</span>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    {/* Row 2: Strictly single-line Live Process Headline + Compact Telemetry (never wraps or shifts chart height) */}
    <div className="flex h-7 shrink-0 flex-nowrap items-center justify-between gap-2 overflow-hidden px-2.5 pt-1 text-[11px]">
      <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
        {heroCylinder && (
          <span className="shrink-0 whitespace-nowrap rounded-md border border-teal-400/40 bg-teal-400/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-teal-200">
            {heroCylinder.label}
          </span>
        )}
        <span className="min-w-0 truncate font-semibold text-white" title={live.processLabel}>{live.processLabel}</span>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${mode === 'practical' ? 'bg-amber-400/15 text-amber-300' : 'bg-teal-400/15 text-teal-300'}`}>
          {workPct}%
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-slate-300">
        <span>V<strong className="ml-0.5 text-white">{live.volume.toFixed(1)}×</strong></span>
        <span>P<strong className="ml-0.5 text-teal-300">{live.pressure.toFixed(1)}×</strong></span>
        <span>T<strong className="ml-0.5 text-amber-300">{live.temperature.toFixed(1)}×</strong></span>
      </div>
    </div>

    {/* Optional Row 2b: Interactive Multi-Cylinder Firing-Order Strip */}
    {firingOrder && firingOrder.length > 1 && cycleCues.setHeroCylinder && (
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/5 px-2.5 py-1" role="radiogroup" aria-label="Firing order cylinder selector">
        <span className="shrink-0 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">Firing</span>
        {firingOrder.map((item) => {
          const selected = item.id === snapshot.cycleHeroCylinderId;
          const dot = item.stroke === 'intake' ? 'bg-cyan-300' : item.stroke === 'compression' ? 'bg-indigo-400' : item.stroke === 'power' ? 'bg-orange-400' : 'bg-amber-300';
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={`${item.label}: ${item.stroke} (${Math.round(item.angleDeg)}°)`}
              onClick={() => cycleCues.setHeroCylinder!(item.id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${selected ? 'border-teal-400 bg-teal-400/20 text-white font-bold' : item.firing ? 'border-orange-400/60 bg-orange-400/15 text-orange-100' : 'border-white/10 bg-slate-950/40 text-slate-300 hover:text-white'}`}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {item.id}
            </button>
          );
        })}
      </div>
    )}

    {/* Row 3: Live Synchronized Side-by-Side P–V and T–s Charts (fills remaining space cleanly) */}
    <div className="min-h-0 flex-1 px-2.5 py-1.5 flex flex-col">
      <OttoCharts
        angle={angle}
        mode={mode}
        cycleType={cycleType}
        plotView={plotView}
        onSeekAngle={seekAngle}
        sideBySide
        className="min-h-0 flex-1"
      />
      {/* Compact layer chips + fuel delivery toggle + mobile P–V/T–s zoom toggle */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {cycleCues.setLayer && (
            <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Flow layers">
              {([
                ['air', cycleType === 'two-stroke' ? 'Ports' : 'Air', 'bg-cyan-300'],
                ['fuel', cycleType === 'diesel' ? 'Direct inj.' : cycleType === 'two-stroke' ? 'Transfer' : 'Fuel', 'bg-rose-400'],
                ['chamber', 'Charge', 'bg-amber-400'],
              ] as const).map(([key, label, dot]) => {
                const on = snapshot.cycleLayers?.[key] ?? true;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => cycleCues.setLayer!(key, !on)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${on ? 'border-teal-400/40 bg-teal-400/10 text-white' : 'border-white/10 text-slate-500'}`}
                  >
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot} ${on ? '' : 'opacity-30'}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {cycleCues.setFuelSystem && (
            <button
              type="button"
              aria-label={`Fuel system: ${(snapshot.cycleFuelSystem ?? 'injected') === 'carburetted' ? 'Carburetted (illustrative)' : 'Port injected'}. Tap to switch.`}
              onClick={() => cycleCues.setFuelSystem!((snapshot.cycleFuelSystem ?? 'injected') === 'injected' ? 'carburetted' : 'injected')}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${(snapshot.cycleFuelSystem ?? 'injected') === 'carburetted' ? 'border-amber-400/50 bg-amber-400/15 text-amber-200' : 'border-white/15 bg-white/5 text-slate-300 hover:text-white'}`}
            >
              {(snapshot.cycleFuelSystem ?? 'injected') === 'carburetted' ? 'Carb (illus.)' : 'Port inj.'}
            </button>
          )}
        </div>
        <div role="group" aria-label="Chart zoom" className="flex sm:hidden items-center gap-0.5 rounded-lg bg-slate-950/60 p-0.5">
          {(['both', 'pv', 'ts'] as PlotView[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={plotView === v}
              onClick={() => setPlotView(v)}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${plotView === v ? 'bg-white/15 text-teal-200' : 'text-slate-400'}`}
            >
              {v === 'both' ? 'Both' : v === 'pv' ? 'P–V' : 'T–s'}
            </button>
          ))}
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-right text-[10px] text-slate-400 sm:block" title={live.explanation}>
          {live.explanation}
        </p>
      </div>
    </div>

    {/* Row 4: Pinned 1-Row Crank Player (Reset · Play/Pause · 0-720° Scrubber · Degree · Speed) */}
    <div className="flex shrink-0 items-center gap-1.5 border-t border-white/10 bg-inset/80 px-2.5 py-1.5">
      <button
        type="button"
        aria-label="Reset motion to start"
        title="Reset motion to start"
        onClick={() => motion.reset()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/5 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => motion.setPlaying(!playing)}
        className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-teal-400 px-3 text-xs font-bold text-slate-950 shadow-sm shadow-teal-400/20 transition-colors hover:bg-teal-300 outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        {playing ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>

      <input
        type="range"
        aria-label="Crank angle"
        min="0"
        max={maxAngle}
        step="1"
        value={angle}
        onChange={(event) => seekAngle(Number(event.target.value))}
        className="h-10 min-w-0 flex-1 accent-teal-400 cursor-pointer"
      />

      <output className="w-9 shrink-0 text-right font-mono text-xs font-bold text-amber-300">
        {Math.round(angle)}°
      </output>

      {motion.setSpeed && (
        <button
          type="button"
          aria-label={`Playback speed ${speed}×. Tap to cycle.`}
          title="Tap to cycle speed"
          onClick={cycleSpeed}
          className="flex h-10 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 px-2 font-mono text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          {speed}×
        </button>
      )}
    </div>
  </aside>;
}
