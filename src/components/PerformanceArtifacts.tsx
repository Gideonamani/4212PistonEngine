import React, { useId, useState } from 'react';
import { airAvailable } from './airDensity.mjs';

/**
 * Native lesson interactive for lesson 13 (Factors Affecting Power): how altitude, temperature and humidity change the air a naturally
 * aspirated cylinder can draw in. The physics is the standard atmosphere and the ideal-gas law (src/components/airDensity.mjs); the
 * "air available" figure is a teaching quantity, not a prediction of any engine's power.
 */

const panel = 'rounded-xl border border-teal-500/20 bg-[#061418] p-3 text-slate-100';
const button = 'min-h-11 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400';

type Conditions = { altitudeFt: number; temperatureOffsetC: number; relativeHumidityPct: number };

const PRESETS: { label: string; values: Conditions }[] = [
  { label: 'Standard day, sea level', values: { altitudeFt: 0, temperatureOffsetC: 0, relativeHumidityPct: 0 } },
  { label: 'Hot, humid day at sea level', values: { altitudeFt: 0, temperatureOffsetC: 20, relativeHumidityPct: 80 } },
  { label: 'Cold, dry day at 5,000 ft', values: { altitudeFt: 5000, temperatureOffsetC: -15, relativeHumidityPct: 10 } },
];

const Slider: React.FC<{ id: string; label: string; value: number; min: number; max: number; step: number; format: (value: number) => string; onChange: (value: number) => void }> = ({ id, label, value, min, max, step, format, onChange }) => (
  <div>
    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-xs font-semibold text-white"><span>{label}</span><span className="font-mono text-teal-300">{format(value)}</span></label>
    <input id={id} className="h-11 w-full accent-teal-400" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </div>
);

export function AirDensityExplorer() {
  const baseId = useId();
  const [conditions, setConditions] = useState<Conditions>(PRESETS[0].values);
  const result = airAvailable(conditions);
  const percent = Math.round(result.airAvailable * 1000) / 10;
  const set = (patch: Partial<Conditions>) => setConditions((previous) => ({ ...previous, ...patch }));
  const signed = (value: number) => `${value > 0 ? '+' : ''}${value} °C`;

  return <div className={panel}>
    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Example days">
      {PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => setConditions(preset.values)} className={button}>{preset.label}</button>)}
    </div>
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-3">
      <Slider id={`${baseId}-altitude`} label="Altitude" value={conditions.altitudeFt} min={0} max={12000} step={500} format={(value) => `${value.toLocaleString()} ft`} onChange={(altitudeFt) => set({ altitudeFt })} />
      <Slider id={`${baseId}-temperature`} label="Temperature compared with standard" value={conditions.temperatureOffsetC} min={-30} max={30} step={1} format={signed} onChange={(temperatureOffsetC) => set({ temperatureOffsetC })} />
      <Slider id={`${baseId}-humidity`} label="Relative humidity" value={conditions.relativeHumidityPct} min={0} max={100} step={5} format={(value) => `${value}%`} onChange={(relativeHumidityPct) => set({ relativeHumidityPct })} />
    </div>
    <div className="mt-3" role="img" aria-label={`Air available to burn: ${percent} percent of a standard sea-level day`}>
      <div className="flex justify-between font-mono text-[11px] text-slate-300"><span>Air available to burn</span><span className="font-bold text-white">{percent.toFixed(1)}%</span></div>
      <div className="mt-1 h-4 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${Math.min(100, percent)}%` }} /></div>
    </div>
    <p className="mt-2 text-xs text-slate-300">Outside: <strong className="text-white">{result.pressureInHg.toFixed(1)} inHg</strong> and <strong className="text-white">{result.temperatureC.toFixed(0)} °C</strong>. Each intake stroke draws in the same volume of air, but a volume holds less oxygen when the air is thinner, hotter or wetter.</p>
    <p className="mt-1 text-[11px] text-slate-400">Standard atmosphere and ideal-gas law. A naturally aspirated engine&apos;s power follows the mass of air it breathes, so expect something like this fraction of its standard sea-level power; real engines differ. A supercharged engine holds its manifold pressure up to its critical altitude.</p>
  </div>;
}
