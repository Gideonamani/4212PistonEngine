import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HEAT_SPLIT, STAGES } from './energyChain.mjs';

/**
 * Native lesson interactive for lesson 10 (Power Generation): a walk along the energy chain from the fuel to thrust. Each stage names the
 * form the energy has, what happens there and what turns it into the next stage. The figures are the FAA handbook's, with their pages.
 */

const panel = 'rounded-xl border border-teal-500/20 bg-inset p-3 text-slate-100';
const button = 'min-h-11 min-w-11 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400 aria-pressed:border-teal-400 aria-pressed:bg-teal-500/15 aria-pressed:text-teal-200 disabled:opacity-40';
const caption = 'mt-2 text-[11px] text-slate-400';
const BAR_COLOURS: Record<string, string> = { power: 'var(--color-teal-400)', cooling: 'var(--color-orange-400)', friction: 'var(--color-amber-400)', exhaust: 'var(--color-slate-400)' };

export function EnergyChainWalk() {
  const [index, setIndex] = useState(0);
  const stage = STAGES[index];
  const last = index === STAGES.length - 1;

  return <div className={panel}>
    <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="The stages of the energy chain">
      {STAGES.map((item, position) => <li key={item.id}>
        <button type="button" aria-pressed={position === index} onClick={() => setIndex(position)} className={button}>
          <span className="mr-1 font-mono text-slate-400">{position + 1}</span>{item.name}
        </button>
      </li>)}
    </ol>
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3" aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">Stage {index + 1} of {STAGES.length} · {stage.form}</p>
      <h3 className="mt-0.5 text-base font-bold text-white">{stage.name}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-200">{stage.text}</p>
      <p className="mt-2 text-[11px] text-slate-300"><strong className="text-white">Where:</strong> {stage.place}.</p>
      {!last && <p className="mt-1 text-[11px] text-slate-300"><strong className="text-white">Becomes the next stage through:</strong> {stage.converter}.</p>}
      {stage.showsHeatSplit && <div className="mt-3">
        <p className="text-[11px] font-semibold text-slate-200">Where the heat goes, in percent of the heat produced</p>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {HEAT_SPLIT.map((part) => <li key={part.id} className="text-[11px] text-slate-300">
            <span className="flex justify-between gap-2"><span>{part.label}</span><span className="font-mono text-slate-200">{part.low} to {part.high}</span></span>
            <span className="relative mt-1 block h-3 rounded bg-slate-800" aria-hidden="true"><span className="absolute inset-y-0 rounded" style={{ left: `${part.low}%`, width: `${part.high - part.low}%`, background: BAR_COLOURS[part.id] }} /></span>
          </li>)}
        </ul>
      </div>}
      <p className="mt-2 text-[11px] text-slate-400">{stage.page}, FAA-H-8083-32B (2023).</p>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <button type="button" className={button} disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />Previous stage</button>
      <button type="button" className={button} disabled={last} onClick={() => setIndex(index + 1)}>Next stage<ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></button>
    </div>
    <p className={caption}>Figures from the FAA handbook; real engines differ. The handbook gives the heat split as ranges, drawn here as bands.</p>
  </div>;
}
