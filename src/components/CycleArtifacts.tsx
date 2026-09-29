import React, { useMemo, useState } from 'react';

/**
 * Native lesson interactives for lessons 3 and 4 (dead centres, swept/clearance volume, Otto and Diesel
 * pressure-volume diagrams, valve timing, engine data comparison).
 *
 * Everything here is schematic: pressure-volume shapes come from the ideal-gas relations, valve timing uses the
 * FAA handbook's example chart, and engine data is transcribed from the cited manuals. No chart claims to be
 * measured data for a real engine.
 */

const panel = 'rounded-xl border border-teal-500/20 bg-[#061418] p-3 text-slate-100';
const button = 'rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400 aria-pressed:border-teal-400 aria-pressed:bg-teal-500/15 aria-pressed:text-teal-200';
const caption = 'mt-2 text-[10px] text-slate-500';

// ---------------------------------------------------------------------------------------------------------------
// Swept volume, clearance volume and compression ratio
// ---------------------------------------------------------------------------------------------------------------

type VolumeView = 'swept' | 'clearance' | 'total';

// GTSIO-520-H compression ratio (overhaul manual, Chapter C-3). With a constant bore, cylinder heights are proportional
// to volumes, so the clearance height is swept height / (CR - 1).
const DRAWN_COMPRESSION_RATIO = 7.5;

export function SweptVolumeDiagram() {
  const [angle, setAngle] = useState(0);
  const [view, setView] = useState<VolumeView>('swept');
  const top = 26;
  const swept = 120;
  const clearance = swept / (DRAWN_COMPRESSION_RATIO - 1);
  const pistonH = 16;
  const tdcCrownY = top + clearance;
  const bdcCrownY = tdcCrownY + swept;
  const travel = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
  const crownY = tdcCrownY + travel * swept;
  const left = 44;
  const width = 96;
  const atTdc = angle === 0 || angle === 360;
  const atBdc = angle === 180;
  const readout = atTdc ? 'Top dead centre (TDC): the piston is at the top of its travel and reverses direction.'
    : atBdc ? 'Bottom dead centre (BDC): the piston is at the bottom of its travel and reverses direction.'
      : angle < 180 ? 'The piston is moving toward BDC.' : 'The piston is moving toward TDC.';
  const viewText: Record<VolumeView, string> = {
    swept: 'Swept volume (piston displacement): the space the piston sweeps between TDC and BDC. Bore and stroke set it.',
    clearance: 'Clearance volume: the space left above the piston at TDC.',
    total: 'Total volume at BDC = swept + clearance. Compression ratio = total volume at BDC ÷ clearance volume at TDC.',
  };
  return <div className={panel}>
    <div className="mb-3 grid grid-cols-3 gap-1.5">
      {(['swept', 'clearance', 'total'] as VolumeView[]).map((item) => <button key={item} type="button" className={button} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'swept' ? 'Swept' : item === 'clearance' ? 'Clearance' : 'Total'}</button>)}
    </div>
    <div className="grid items-center gap-3 sm:grid-cols-[13rem_minmax(0,1fr)]">
      <svg viewBox="0 0 190 190" role="img" aria-label="Cylinder showing swept volume, clearance volume, bore and stroke" className="mx-auto h-56 w-full max-w-56 rounded-lg bg-slate-950/50">
        <rect x={left} y={top} width={width} height={clearance + swept + 10} fill="#0c2026" stroke="#55707a" strokeWidth="3" />
        {(view === 'clearance' || view === 'total') && <rect x={left + 1.5} y={top} width={width - 3} height={clearance} fill="#f59e0b" opacity=".45" />}
        {(view === 'swept' || view === 'total') && <rect x={left + 1.5} y={tdcCrownY} width={width - 3} height={swept} fill="#2dd4bf" opacity=".28" />}
        <path d={`M${left - 4} ${tdcCrownY}h${width + 8}M${left - 4} ${bdcCrownY}h${width + 8}`} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth="1.5" />
        <rect x={left + 3} y={crownY} width={width - 6} height={pistonH} rx="3" fill="#94a3b8" stroke="#e2e8f0" />
        <path d={`M${left + width / 2} ${crownY + pistonH}v${Math.max(6, bdcCrownY + pistonH + 8 - crownY - pistonH)}`} stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
        <path d={`M${left} ${top - 10}h${width}`} stroke="#67e8f9" strokeWidth="1.5" />
        <path d={`M${left} ${top - 14}v8M${left + width} ${top - 14}v8`} stroke="#67e8f9" strokeWidth="1.5" />
        <path d={`M${left + width + 14} ${tdcCrownY}v${swept}`} stroke="#67e8f9" strokeWidth="1.5" />
        <path d={`M${left + width + 10} ${tdcCrownY}h8M${left + width + 10} ${bdcCrownY}h8`} stroke="#67e8f9" strokeWidth="1.5" />
        <g fontSize="9" fill="#cbd5e1">
          <text x={left + width / 2} y={top - 15} textAnchor="middle">bore</text>
          <text x={left + width + 22} y={tdcCrownY + swept / 2 + 3}>stroke</text>
          <text x="4" y={tdcCrownY + 3}>TDC</text><text x="4" y={bdcCrownY + 3}>BDC</text>
        </g>
      </svg>
      <div>
        <input aria-label="Crank angle" className="w-full accent-teal-400" type="range" min="0" max="360" value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>0° TDC</span><span>180° BDC</span><span>360° TDC</span></div>
        <p className="mt-3 text-xs text-slate-300"><strong className="text-white">Crank angle {angle}°.</strong> {readout}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">{viewText[view]}</p>
      </div>
    </div>
    <p className={caption}>Cylinder drawn at a 7.5:1 compression ratio (the GTSIO-520-H figure) so volumes are to scale; connecting rod length is simplified.</p>
  </div>;
}

// ---------------------------------------------------------------------------------------------------------------
// Pressure-volume diagrams (Otto and Diesel)
// ---------------------------------------------------------------------------------------------------------------

type Pt = [number, number];
type Loop = Pt[][]; // four processes, each sampled at the same number of points

const GAMMA = 1.4;
const SAMPLES = 36;
const sample = (f: (t: number) => Pt): Pt[] => Array.from({ length: SAMPLES + 1 }, (_, i) => f(i / SAMPLES));

// Volumes are in units of the clearance volume (TDC = 1, BDC = r); pressures are relative to the pressure at BDC.
function ottoLoop(r: number): Loop {
  const p2 = Math.pow(r, GAMMA);
  const p3 = p2 * 3; // schematic heat addition: pressure ratio of 3
  return [
    sample((t) => { const v = r + (1 - r) * t; return [v, Math.pow(r / v, GAMMA)]; }), // 1-2 compression
    sample((t) => [1, p2 + (p3 - p2) * t]), // 2-3 constant volume heat addition
    sample((t) => { const v = 1 + (r - 1) * t; return [v, p3 / Math.pow(v, GAMMA)]; }), // 3-4 expansion
    sample((t) => [r, p3 / Math.pow(r, GAMMA) + (1 - p3 / Math.pow(r, GAMMA)) * t]), // 4-1 constant volume heat rejection
  ];
}

function dieselLoop(r: number): Loop {
  const p2 = Math.pow(r, GAMMA);
  const cutoff = Math.min(2, r * 0.4); // schematic end of fuel injection/burning
  return [
    sample((t) => { const v = r + (1 - r) * t; return [v, Math.pow(r / v, GAMMA)]; }), // 1-2 compression of air
    sample((t) => [1 + (cutoff - 1) * t, p2]), // 2-3 constant pressure heat addition
    sample((t) => { const v = cutoff + (r - cutoff) * t; return [v, p2 * Math.pow(cutoff / v, GAMMA)]; }), // 3-4 expansion
    sample((t) => { const p4 = p2 * Math.pow(cutoff / r, GAMMA); return [r, p4 + (1 - p4) * t]; }), // 4-1 constant volume heat rejection
  ];
}

// Moving-average smoothing of the closed loop rounds the sharp corners and lowers the peak, which is what finite
// burn time, valve lead/lag and heat loss do to a real indicator diagram (schematic only).
function practicalLoop(loop: Loop): Loop {
  const flat = loop.flat();
  const n = flat.length;
  const window = 5;
  const smoothed: Pt[] = flat.map((_, i) => {
    let sx = 0; let sy = 0;
    for (let k = -window; k <= window; k += 1) { const p = flat[(i + k + n) % n]; sx += p[0]; sy += p[1]; }
    return [sx / (2 * window + 1), sy / (2 * window + 1)];
  });
  return [0, 1, 2, 3].map((index) => smoothed.slice(index * (SAMPLES + 1), (index + 1) * (SAMPLES + 1)));
}

const PLOT = { w: 300, h: 210, left: 30, bottom: 26, top: 12, right: 10 };

function makeScales(loops: Loop[], r: number) {
  const maxP = Math.max(...loops.flatMap((loop) => loop.flat().map((point) => point[1]))) * 1.08;
  const x = (v: number) => PLOT.left + ((v - 0.7) / (r + 0.5 - 0.7)) * (PLOT.w - PLOT.left - PLOT.right);
  const y = (p: number) => PLOT.h - PLOT.bottom - (p / maxP) * (PLOT.h - PLOT.bottom - PLOT.top);
  return { x, y };
}

const pathOf = (points: Pt[], scales: ReturnType<typeof makeScales>) => points.map(([v, p], i) => `${i ? 'L' : 'M'}${scales.x(v).toFixed(1)} ${scales.y(p).toFixed(1)}`).join('');

// One continuous closed outline, so the fill covers the loop instead of closing each process separately.
const loopPath = (loop: Loop, scales: ReturnType<typeof makeScales>) => `${loop.flat().map(([v, p], i) => `${i ? 'L' : 'M'}${scales.x(v).toFixed(1)} ${scales.y(p).toFixed(1)}`).join('')}Z`;

function PVAxes({ scales, r }: { scales: ReturnType<typeof makeScales>; r: number }) {
  return <g>
    <path d={`M${PLOT.left} ${PLOT.top}V${PLOT.h - PLOT.bottom}H${PLOT.w - PLOT.right}`} stroke="#64748b" strokeWidth="1.5" fill="none" />
    <path d={`M${scales.x(1)} ${PLOT.h - PLOT.bottom}v4M${scales.x(r)} ${PLOT.h - PLOT.bottom}v4`} stroke="#94a3b8" />
    <g fontSize="9" fill="#94a3b8" textAnchor="middle">
      <text x={scales.x(1)} y={PLOT.h - 9}>TDC</text><text x={scales.x(r)} y={PLOT.h - 9}>BDC</text>
      <text x={(PLOT.left + PLOT.w) / 2} y={PLOT.h - 0}>Volume →</text>
      <text transform={`translate(9 ${PLOT.h / 2}) rotate(-90)`}>Pressure →</text>
    </g>
  </g>;
}

const OTTO_PROCESSES = [
  { label: '1 → 2 Compression', ideal: 'The piston rises, volume falls and pressure rises. No heat is exchanged with the surroundings (adiabatic).', practical: 'Some heat leaks to the cylinder walls, so the compression line differs slightly from the ideal one.' },
  { label: '2 → 3 Heat added', ideal: 'All the heat is added instantly while the volume stays constant at TDC, so pressure jumps straight up.', practical: 'Burning takes time. Pressure builds over several degrees and peaks a little after TDC, at a lower value.' },
  { label: '3 → 4 Expansion', ideal: 'The hot gas pushes the piston down (the power stroke); volume rises, pressure falls, and again no heat is exchanged.', practical: 'Heat is still lost to the walls, and the exhaust valve opens before BDC, rounding the end of the stroke.' },
  { label: '4 → 1 Heat rejected', ideal: 'Heat is rejected at constant volume at BDC: pressure falls back to the starting value.', practical: 'Exhaust gas leaves over a range of crank angle, with pumping losses on the exhaust and intake strokes.' },
];

function pointAt(loop: Loop, progress: number) {
  const flat = loop.flat();
  const index = Math.min(flat.length - 1, Math.round((progress / 100) * (flat.length - 1)));
  return { point: flat[index], process: Math.min(3, Math.floor(index / (SAMPLES + 1))) };
}

function PistonStrip({ v, r }: { v: number; r: number }) {
  const frac = (v - 1) / (r - 1);
  const y = 20 + frac * 60;
  return <svg viewBox="0 0 60 130" role="img" aria-label="Piston position" className="h-40 w-16 rounded-lg bg-slate-950/50">
    <rect x="10" y="6" width="40" height="100" fill="#0c2026" stroke="#55707a" strokeWidth="2" />
    <rect x="12" y={y} width="36" height="10" rx="2" fill="#94a3b8" stroke="#e2e8f0" />
    <path d={`M30 ${y + 10}v${106 - y - 4}`} stroke="#64748b" strokeWidth="4" />
    <text x="30" y="122" fontSize="8" fill="#94a3b8" textAnchor="middle">piston</text>
  </svg>;
}

export function OttoPVDiagram({ startPractical = false }: { startPractical?: boolean }) {
  const r = 8;
  const [mode, setMode] = useState<'ideal' | 'practical'>(startPractical ? 'practical' : 'ideal');
  const [progress, setProgress] = useState(12);
  const ideal = useMemo(() => ottoLoop(r), []);
  const practical = useMemo(() => practicalLoop(ideal), [ideal]);
  const scales = useMemo(() => makeScales([ideal], r), [ideal]);
  const active = mode === 'ideal' ? ideal : practical;
  const { point, process } = pointAt(active, progress);
  const info = OTTO_PROCESSES[process];
  return <div className={panel}>
    <div className="mb-3 flex gap-1.5">
      <button type="button" className={button} aria-pressed={mode === 'ideal'} onClick={() => setMode('ideal')}>Ideal cycle</button>
      <button type="button" className={button} aria-pressed={mode === 'practical'} onClick={() => setMode('practical')}>Practical cycle</button>
    </div>
    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_4rem]">
      <svg viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} role="img" aria-label={`${mode} Otto cycle pressure-volume diagram`} className="mx-auto max-h-64 w-full rounded-lg bg-slate-950/50">
        <PVAxes scales={scales} r={r} />
        {mode === 'practical' && <path d={loopPath(ideal, scales)} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />}
        <path d={loopPath(active, scales)} fill="rgba(45,212,191,.10)" stroke="#2dd4bf" strokeWidth="2" />
        <path d={pathOf(active[process], scales)} fill="none" stroke="#f59e0b" strokeWidth="3.5" />
        <circle cx={scales.x(point[0])} cy={scales.y(point[1])} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
        <g fontSize="10" fill="#e2e8f0" fontWeight="700">
          <text x={scales.x(ideal[0][0][0]) - 12} y={scales.y(1) + 3}>1</text>
          <text x={scales.x(1) + 6} y={scales.y(ideal[1][0][1]) - 2}>2</text>
          <text x={scales.x(1) + 6} y={scales.y(ideal[1][SAMPLES][1]) + 8}>3</text>
          <text x={scales.x(8) + 5} y={scales.y(ideal[3][0][1]) + 3}>4</text>
        </g>
      </svg>
      <div className="hidden justify-self-center sm:block"><PistonStrip v={point[0]} r={r} /></div>
    </div>
    <label className="mt-3 block text-xs font-semibold text-slate-300" htmlFor={`otto-progress-${startPractical ? 'p' : 'i'}`}>Step through the cycle</label>
    <input id={`otto-progress-${startPractical ? 'p' : 'i'}`} className="mt-1 w-full accent-teal-400" type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
    <p className="mt-2 text-xs leading-relaxed text-slate-300"><strong className="text-white">{info.label}.</strong> {mode === 'ideal' ? info.ideal : info.practical}</p>
    <p className={caption}>Schematic curves from the ideal-gas relations (compression ratio drawn as 8:1). Practical mode rounds the ideal loop to illustrate real-engine effects; it is not measured data for any engine. The dashed line is the ideal cycle.</p>
  </div>;
}

export function DieselOttoCompare() {
  const [r, setR] = useState(12);
  const [show, setShow] = useState<'both' | 'otto' | 'diesel'>('both');
  const otto = useMemo(() => ottoLoop(r), [r]);
  const diesel = useMemo(() => dieselLoop(r), [r]);
  const scales = useMemo(() => makeScales([otto, diesel], r), [otto, diesel, r]);
  const items: { key: 'both' | 'otto' | 'diesel'; label: string }[] = [{ key: 'both', label: 'Compare' }, { key: 'otto', label: 'Otto' }, { key: 'diesel', label: 'Diesel' }];
  return <div className={panel}>
    <div className="mb-3 flex gap-1.5">{items.map((item) => <button key={item.key} type="button" className={button} aria-pressed={show === item.key} onClick={() => setShow(item.key)}>{item.label}</button>)}</div>
    <svg viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} role="img" aria-label="Otto and Diesel cycle pressure-volume diagrams" className="mx-auto max-h-64 w-full rounded-lg bg-slate-950/50">
      <PVAxes scales={scales} r={r} />
      {(show === 'both' || show === 'otto') && <path d={loopPath(otto, scales)} fill="rgba(45,212,191,.08)" stroke="#2dd4bf" strokeWidth="2" />}
      {(show === 'both' || show === 'diesel') && <path d={loopPath(diesel, scales)} fill="rgba(245,158,11,.08)" stroke="#f59e0b" strokeWidth="2" />}
      {(show === 'both' || show === 'otto') && <path d={pathOf(otto[1], scales)} fill="none" stroke="#5eead4" strokeWidth="4" />}
      {(show === 'both' || show === 'diesel') && <path d={pathOf(diesel[1], scales)} fill="none" stroke="#fbbf24" strokeWidth="4" />}
    </svg>
    <div className="mt-2 flex flex-wrap gap-3 text-[11px]"><span className="text-teal-300">■ Otto: heat added at constant volume (vertical line)</span><span className="text-amber-300">■ Diesel: heat added at constant pressure (flat line)</span></div>
    <label className="mt-3 block text-xs font-semibold text-slate-300" htmlFor="diesel-cr">Compression ratio (schematic): {r}:1</label>
    <input id="diesel-cr" className="mt-1 w-full accent-teal-400" type="range" min="6" max="20" value={r} onChange={(event) => setR(Number(event.target.value))} />
    <p className={caption}>Ideal-gas curves for comparing the shapes of the two cycles. Both start with the same compression; only the heat-addition process differs. Diesel engines run a much higher compression ratio than gasoline engines. Not engine performance data.</p>
  </div>;
}

// ---------------------------------------------------------------------------------------------------------------
// Valve timing (FAA example chart)
// ---------------------------------------------------------------------------------------------------------------

// FAA-H-8083-32B (2023), Figure 1-37 (PDF p. 47): example valve timing chart. Angles are on a 0-720 degree cycle that starts
// at TDC of the intake stroke. Timing varies considerably between engines; the manufacturer's data governs.
const INTAKE_OPENS = 670; // 50 degrees before TDC (end of exhaust stroke)
const INTAKE_CLOSES = 210; // 30 degrees after BDC (compression stroke)
const EXHAUST_OPENS = 510; // 30 degrees before BDC (power stroke)
const EXHAUST_CLOSES = 25; // 25 degrees after TDC (start of intake stroke)

const intakeOpen = (a: number) => a >= INTAKE_OPENS || a < INTAKE_CLOSES;
const exhaustOpen = (a: number) => a >= EXHAUST_OPENS || a < EXHAUST_CLOSES;

export function ValveTimingDiagram() {
  const [angle, setAngle] = useState(0);
  const chartX = (a: number) => 8 + (a / 720) * 584;
  const bands = [{ name: 'Intake', from: 0 }, { name: 'Compression', from: 180 }, { name: 'Power', from: 360 }, { name: 'Exhaust', from: 540 }];
  const stroke = bands[Math.min(3, Math.floor(angle / 180))].name;
  const intake = intakeOpen(angle);
  const exhaust = exhaustOpen(angle);
  const segments = (ranges: [number, number][], y: number, fill: string) => ranges.map(([a, b], i) => <rect key={i} x={chartX(a)} y={y} width={chartX(b) - chartX(a)} height="20" rx="3" fill={fill} />);
  const marks: { id: string; a: number; y: number }[] = [{ id: 'A', a: INTAKE_OPENS, y: 62 }, { id: 'B', a: INTAKE_CLOSES, y: 62 }, { id: 'C', a: EXHAUST_OPENS, y: 90 }, { id: 'D', a: EXHAUST_CLOSES, y: 90 }];
  return <div className={panel}>
    <svg viewBox="0 0 600 136" role="img" aria-label="Valve timing chart for one four-stroke cycle" className="w-full rounded-lg bg-slate-950/50">
      {bands.map((band, i) => <g key={band.name}><rect x={chartX(band.from)} y="6" width={chartX(180) - chartX(0)} height="20" fill={i % 2 ? '#132b31' : '#0e2228'} stroke="#1e3a42" /><text x={chartX(band.from + 90)} y="21" fontSize="14" fill={band.name === stroke ? '#5eead4' : '#94a3b8'} textAnchor="middle" fontWeight={band.name === stroke ? 700 : 400}>{band.name}</text></g>)}
      {segments([[0, INTAKE_CLOSES], [INTAKE_OPENS, 720]], 48, '#2dd4bf')}
      {segments([[0, EXHAUST_CLOSES], [EXHAUST_OPENS, 720]], 76, '#fb923c')}
      <rect x={chartX(INTAKE_OPENS)} y="46" width={chartX(720) - chartX(INTAKE_OPENS)} height="52" fill="#fde68a" opacity=".22" />
      <rect x={chartX(0)} y="46" width={chartX(EXHAUST_CLOSES) - chartX(0)} height="52" fill="#fde68a" opacity=".22" />
      <g fontSize="14" fill="#e2e8f0" stroke="#061418" strokeWidth="3" paintOrder="stroke" fontWeight="600"><text x={chartX(240)} y="62">Intake valve</text><text x={chartX(240)} y="90">Exhaust valve</text></g>
      {marks.map((mark) => <g key={mark.id}><circle cx={chartX(mark.a)} cy={mark.y - 4} r="8" fill="#0f172a" stroke="#f8fafc" /><text x={chartX(mark.a)} y={mark.y - 0.5} fontSize="11" fill="#f8fafc" textAnchor="middle" fontWeight="700">{mark.id}</text></g>)}
      <path d={`M${chartX(angle)} 4V108`} stroke="#f8fafc" strokeWidth="2" />
      <g fontSize="13" fill="#94a3b8" textAnchor="middle"><text x={chartX(0)} y="126" textAnchor="start">TDC</text><text x={chartX(180)} y="126">BDC</text><text x={chartX(360)} y="126">TDC</text><text x={chartX(540)} y="126">BDC</text><text x={chartX(720)} y="126" textAnchor="end">TDC</text></g>
    </svg>
    <input aria-label="Crank angle" className="mt-3 w-full accent-teal-400" type="range" min="0" max="719" value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
    <p className="mt-2 text-xs text-slate-300"><strong className="text-white">{stroke} stroke · crank angle {angle}°.</strong> Intake valve {intake ? 'open' : 'closed'}; exhaust valve {exhaust ? 'open' : 'closed'}{intake && exhaust ? ' - both open: valve overlap.' : '.'}</p>
    <ul className="mt-2 grid gap-1 text-[11px] text-slate-300 sm:grid-cols-2">
      <li><strong className="text-white">A</strong> Intake opens 50° before TDC (valve lead)</li>
      <li><strong className="text-white">B</strong> Intake closes 30° after BDC (valve lag)</li>
      <li><strong className="text-white">C</strong> Exhaust opens 30° before BDC</li>
      <li><strong className="text-white">D</strong> Exhaust closes 25° after TDC (valve lag)</li>
    </ul>
    <p className="mt-1 text-[11px] text-amber-200">Overlap (shaded) = A to D around TDC: 50° + 25° = 75°, both valves open.</p>
    <p className={caption}>FAA handbook example chart (Figure 1-37). Real valve timing varies considerably between engines; use the engine manufacturer's data, never this chart, for any setting.</p>
  </div>;
}

// ---------------------------------------------------------------------------------------------------------------
// Engine data comparison: GTSIO-520-H (course engine) and IO-520 (comparison engine)
// ---------------------------------------------------------------------------------------------------------------

const ENGINE_ROWS: { label: string; gtsio: string; io: string; same?: boolean }[] = [
  { label: 'Cylinders / arrangement', gtsio: '6, horizontally opposed', io: '6, horizontally opposed', same: true },
  { label: 'Strokes per cycle', gtsio: '4', io: '4', same: true },
  { label: 'Bore', gtsio: '5.250 in', io: '5.25 in', same: true },
  { label: 'Stroke', gtsio: '4.000 in', io: '4.00 in', same: true },
  { label: 'Displacement', gtsio: '520 cu in (stated)', io: '≈ 520 cu in (calculated from bore and stroke)', same: true },
  { label: 'Compression ratio', gtsio: '7.5:1', io: 'not stated in the overhaul manual' },
  { label: 'Firing order', gtsio: '1-4-5-2-3-6', io: '1-6-3-2-5-4' },
  { label: 'Spark occurs', gtsio: '20° BTC, both magnetos', io: '22° BTC (± 1°) in the manual test data' },
];

export function EngineDataComparison() {
  return <div className={panel}>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] border-collapse text-left text-[11px]">
        <thead><tr className="border-b border-slate-700 text-slate-400"><th className="py-1.5 pr-2 font-semibold">Data</th><th className="py-1.5 pr-2 font-semibold text-teal-300">GTSIO-520-H (course engine)</th><th className="py-1.5 font-semibold text-amber-300">IO-520 (comparison)</th></tr></thead>
        <tbody>{ENGINE_ROWS.map((row) => <tr key={row.label} className="border-b border-slate-800/80 align-top"><th scope="row" className="py-1.5 pr-2 font-medium text-slate-300">{row.label}</th><td className="py-1.5 pr-2 text-slate-100">{row.gtsio}</td><td className={`py-1.5 ${row.same ? 'text-slate-100' : 'text-amber-100'}`}>{row.io}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-300">Same cylinder size, different firing order and spark timing: two engines can share bore, stroke and displacement and still differ in the data that matters for timing and maintenance.</p>
    <p className={caption}>GTSIO-520-H: Continental GTSIO-520 overhaul manual, Chapter C Section III, pp. C-3-2 and C-3-3. IO-520: Continental IO-520 overhaul manual, Tables II and III and the model test data. The IO-520 is a different engine shown for comparison only; check applicability before using any value.</p>
  </div>;
}
