import React, { useState } from 'react';
import { drivenAngle, drivenSpeed, gearPath, idlerAngle, IDLER_TEETH, pitchRadius, speedRatio, startPhase, TEETH_CHOICES, turnsOpposite } from './gearPair.mjs';

/**
 * Native lesson interactive for lesson 9 (Accessories and Drives): two spur gears, and an idler that can be put between them. Schematic:
 * the tooth shapes and sizes are drawn to teach the rule (speed in proportion to teeth, direction reversed by each mesh), not taken from
 * any engine's gear train.
 */

const panel = 'rounded-xl border border-teal-500/20 bg-inset p-3 text-slate-100';
const button = 'min-h-11 min-w-11 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400 aria-pressed:border-teal-400 aria-pressed:bg-teal-500/15 aria-pressed:text-teal-200';
const caption = 'mt-2 text-[11px] text-slate-400';

const DRIVER_RPM = 2400;
const VIEW = { width: 440, height: 190 };

const turnsText = (angle: number) => `${Math.abs(angle / 360).toFixed(2).replace(/\.?0+$/, '')} turn${Math.abs(angle / 360) === 1 ? '' : 's'}`;

export function GearPairExplorer() {
  const [driverTeeth, setDriverTeeth] = useState(12);
  const [drivenTeeth, setDrivenTeeth] = useState(24);
  const [idler, setIdler] = useState(false);
  const [angle, setAngle] = useState(0);
  const idlers = idler ? 1 : 0;

  const radii = { driver: pitchRadius(driverTeeth), idler: pitchRadius(IDLER_TEETH), driven: pitchRadius(drivenTeeth) };
  const span = idler ? 2 * (radii.driver + radii.idler + radii.driven) : 2 * (radii.driver + radii.driven);
  const driverX = (VIEW.width - span) / 2 + radii.driver;
  const idlerX = driverX + radii.driver + radii.idler;
  const drivenX = idler ? idlerX + radii.idler + radii.driven : driverX + radii.driver + radii.driven;
  const y = VIEW.height / 2 - 4;

  const driven = drivenAngle(angle, driverTeeth, drivenTeeth, idlers);
  const idlerTurn = idlerAngle(angle, driverTeeth);
  const ratio = speedRatio(driverTeeth, drivenTeeth);
  const rpm = drivenSpeed(DRIVER_RPM, driverTeeth, drivenTeeth);
  const opposite = turnsOpposite(idlers);
  const faster = ratio > 1 ? 'faster than' : ratio < 1 ? 'slower than' : 'the same speed as';
  const label = `Two spur gears. The driver has ${driverTeeth} teeth and the driven gear has ${drivenTeeth}${idler ? `, with a ${IDLER_TEETH}-tooth idler between them` : ''}. The driver has turned ${turnsText(angle)} clockwise and the driven gear ${turnsText(driven)} ${driven === 0 ? '' : driven > 0 ? 'clockwise' : 'anticlockwise'}.`;

  const choices = (current: number, set: (teeth: number) => void, name: string) => <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${name} teeth`}>
    <span className="w-14 text-[11px] font-semibold text-slate-300">{name}</span>
    {TEETH_CHOICES.map((teeth) => <button key={teeth} type="button" aria-pressed={teeth === current} onClick={() => set(teeth)} className={button}>{teeth} teeth</button>)}
  </div>;

  return <div className={panel}>
    <div className="mb-3 flex flex-col gap-1.5">
      {choices(driverTeeth, setDriverTeeth, 'Driver')}
      {choices(drivenTeeth, setDrivenTeeth, 'Driven')}
      <div className="flex items-center gap-1.5">
        <span className="w-14 text-[11px] font-semibold text-slate-300">Idler</span>
        <button type="button" aria-pressed={idler} onClick={() => setIdler((value) => !value)} className={button}>{idler ? `${IDLER_TEETH}-tooth idler in place` : 'Add an idler'}</button>
      </div>
    </div>
    <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={label} className="w-full rounded-lg bg-slate-950/50">
      <g transform={`translate(${driverX.toFixed(1)} ${y}) rotate(${angle})`}><path d={gearPath(driverTeeth)} fill="var(--color-raised)" stroke="var(--color-teal-400)" strokeWidth="2" /><circle r="4" fill="var(--color-teal-400)" /><path d="M0 0H12" stroke="var(--color-teal-200)" strokeWidth="3" strokeLinecap="round" /></g>
      {idler && <g transform={`translate(${idlerX.toFixed(1)} ${y}) rotate(${180 + startPhase(IDLER_TEETH) + idlerTurn})`}><path d={gearPath(IDLER_TEETH)} fill="var(--color-raised)" stroke="var(--color-slate-400)" strokeWidth="2" /><circle r="4" fill="var(--color-slate-400)" /></g>}
      <g transform={`translate(${drivenX.toFixed(1)} ${y}) rotate(${180 + startPhase(drivenTeeth, idler) + driven})`}><path d={gearPath(drivenTeeth)} fill="var(--color-raised)" stroke="var(--color-amber-400)" strokeWidth="2" /><circle r="4" fill="var(--color-amber-400)" /><path d="M0 0H12" stroke="var(--color-amber-200)" strokeWidth="3" strokeLinecap="round" /></g>
      <g fontSize="12" fill="var(--color-slate-300)">
        <text x={driverX - radii.driver} y={VIEW.height - 6}>Driver · {driverTeeth}</text>
        {idler && <text x={idlerX} y="14" textAnchor="middle">Idler · {IDLER_TEETH}</text>}
        <text x={drivenX + radii.driven} y={VIEW.height - 6} textAnchor="end">Driven · {drivenTeeth}</text>
      </g>
    </svg>
    <label className="mt-2 block text-[11px] font-semibold text-slate-300" htmlFor="gear-pair-angle">Turn the driver gear (clockwise)</label>
    <input id="gear-pair-angle" aria-label="Turn the driver gear" className="h-11 w-full accent-teal-400" type="range" min="0" max="1080" step="1" value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
    <p className="mt-1 text-xs text-slate-300"><strong className="text-white">Driver {turnsText(angle)} · driven {turnsText(driven)}{driven === 0 ? '' : opposite ? ', the opposite way' : ', the same way'}.</strong> The driven gear turns {faster} the driver.</p>
    <p className="mt-1 text-[11px] text-slate-300">Speed ratio = driver teeth ÷ driven teeth = {driverTeeth} ÷ {drivenTeeth} = {Number(ratio.toFixed(3))}. If the driver turns at {DRIVER_RPM.toLocaleString('en')} rpm, the driven gear turns at {Math.round(rpm).toLocaleString('en')} rpm. {idler ? 'The idler turns the driven gear the same way as the driver and does not change the ratio.' : 'Each mesh reverses the direction of rotation.'}</p>
    <p className={caption}>Schematic gears: the sizes and tooth shapes are drawn to show the rule, not taken from any engine&apos;s gear train.</p>
  </div>;
}
