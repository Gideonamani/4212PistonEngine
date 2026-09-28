import React, { useMemo, useState } from 'react';

type ArtifactProps = { id: string };

const panel = 'rounded-xl border border-teal-500/20 bg-[#061418] p-3 text-slate-100';
const button = 'rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400 aria-pressed:border-teal-400 aria-pressed:bg-teal-500/15 aria-pressed:text-teal-200';

const PhaseBadge = ({ active, children }: { active: boolean; children: React.ReactNode }) => (
  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${active ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-slate-700 text-slate-500'}`}>{children}</span>
);

function CycleScrubber() {
  const [angle, setAngle] = useState(0);
  const phaseIndex = Math.min(3, Math.floor(angle / 180));
  const phases = ['Intake', 'Compression', 'Power', 'Exhaust'];
  const pistonY = 77 - 38 * (0.5 - 0.5 * Math.cos((angle * Math.PI) / 180));
  const intakeOpen = phaseIndex === 0;
  const exhaustOpen = phaseIndex === 3;
  return <div className={panel}>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">{phases.map((phase, index) => <PhaseBadge key={phase} active={index === phaseIndex}>{phase}</PhaseBadge>)}</div>
        <input aria-label="Crank angle" className="w-full accent-teal-400" type="range" min="0" max="719" value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>0°</span><span>360°</span><span>720°</span></div>
        <p className="mt-3 text-xs text-slate-300"><strong className="text-white">{phases[phaseIndex]}</strong> · crank angle {angle}°. Intake valve {intakeOpen ? 'open' : 'closed'}; exhaust valve {exhaustOpen ? 'open' : 'closed'}.</p>
      </div>
      <svg viewBox="0 0 180 130" role="img" aria-label={`${phases[phaseIndex]} stroke cylinder diagram`} className="mx-auto h-40 w-full max-w-48 rounded-lg bg-slate-950/50">
        <path d="M48 15h84v103H48z" fill="#0c2026" stroke="#55707a" strokeWidth="3" />
        <path d="M62 16l18 17M118 16l-18 17" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
        <circle cx="90" cy="24" r="4" fill="#f59e0b" />
        <path d={`M55 ${intakeOpen ? 25 : 18}h18M107 ${exhaustOpen ? 25 : 18}h18`} stroke="#2dd4bf" strokeWidth="3" />
        <rect x="56" y={pistonY} width="68" height="18" rx="4" fill="#94a3b8" stroke="#e2e8f0" />
        <path d={`M90 ${pistonY + 18}v22`} stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" />
        <circle cx="90" cy="116" r="8" fill="none" stroke="#2dd4bf" strokeWidth="3" />
        {phaseIndex === 2 && <path d="M72 39l10 11 8-17 8 17 10-11" fill="none" stroke="#f59e0b" strokeWidth="4" />}
      </svg>
    </div>
    <p className="mt-2 text-[10px] text-slate-500">Ideal teaching cycle. Valve timing and motion are schematic, not engine-specific data.</p>
  </div>;
}

function TwoStrokeTiming() {
  const [angle, setAngle] = useState(0);
  const descending = angle < 180;
  const progress = descending ? angle / 180 : (360 - angle) / 180;
  const pistonY = 30 + progress * 54;
  const portsOpen = pistonY > 66;
  return <div className={panel}>
    <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div>
        <div className="flex flex-wrap gap-2"><PhaseBadge active={!descending}>Compression / intake</PhaseBadge><PhaseBadge active={descending}>Power / exhaust</PhaseBadge></div>
        <input aria-label="Two-stroke crank angle" className="mt-4 w-full accent-teal-400" type="range" min="0" max="359" value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
        <p className="mt-3 text-xs leading-relaxed text-slate-300">At {angle}°, the piston is moving <strong className="text-white">{descending ? 'down' : 'up'}</strong>. The transfer and exhaust ports are <strong className="text-white">{portsOpen ? 'uncovered' : 'covered'}</strong>.</p>
      </div>
      <svg viewBox="0 0 180 135" role="img" aria-label="Two-stroke port timing diagram" className="mx-auto h-44 w-full max-w-48 rounded-lg bg-slate-950/50">
        <path d="M50 12h80v110H50z" fill="#0c2026" stroke="#55707a" strokeWidth="3" />
        <path d="M50 69H28v17h22M130 62h22v19h-22" fill="none" stroke={portsOpen ? '#2dd4bf' : '#475569'} strokeWidth="7" />
        <rect x="56" y={pistonY} width="68" height="20" rx="4" fill="#94a3b8" stroke="#e2e8f0" />
        <path d={`M90 ${pistonY + 20}v21`} stroke="#94a3b8" strokeWidth="7" />
        <path d="M32 77h13M135 71h13" stroke="#67e8f9" strokeWidth="3" markerEnd="url(#arrow2)" />
        <defs><marker id="arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0l6 3-6 3z" fill="#67e8f9" /></marker></defs>
        <text x="8" y="103" fill="#94a3b8" fontSize="9">transfer</text><text x="135" y="99" fill="#94a3b8" fontSize="9">exhaust</text>
      </svg>
    </div>
    <p className="mt-2 text-[10px] text-slate-500">Schematic port timing: one crankshaft revolution completes the cycle.</p>
  </div>;
}

type Arrangement = 'Inline' | 'V-type' | 'Radial' | 'Opposed';
function arrangementCylinders(kind: Arrangement) {
  if (kind === 'Inline') return [[90, 25], [90, 50], [90, 75], [90, 100]];
  if (kind === 'V-type') return [[62, 30], [55, 55], [48, 80], [118, 30], [125, 55], [132, 80]];
  if (kind === 'Opposed') return [[38, 45], [38, 82], [142, 45], [142, 82]];
  return Array.from({ length: 7 }, (_, index) => { const a = (index / 7) * Math.PI * 2 - Math.PI / 2; return [90 + Math.cos(a) * 48, 65 + Math.sin(a) * 48]; });
}

function ArrangementDiagram({ kind }: { kind: Arrangement }) {
  const points = arrangementCylinders(kind);
  return <svg viewBox="0 0 180 130" role="img" aria-label={`${kind} cylinder arrangement`} className="h-44 w-full rounded-lg bg-slate-950/50">
    <circle cx="90" cy="65" r="17" fill="#132b31" stroke="#2dd4bf" strokeWidth="3" />
    {points.map(([x, y], index) => <g key={index}><path d={`M90 65L${x} ${y}`} stroke="#64748b" strokeWidth="7" /><rect x={x - 12} y={y - 8} width="24" height="16" rx="4" fill="#94a3b8" stroke="#e2e8f0" /></g>)}
    <circle cx="90" cy="65" r="6" fill="#0f172a" stroke="#67e8f9" />
  </svg>;
}

function ArrangementComparator({ fixed }: { fixed?: Arrangement }) {
  const [selected, setSelected] = useState<Arrangement>(fixed || 'Inline');
  const details: Record<Arrangement, string> = {
    Inline: 'One straight bank; narrow frontal outline.',
    'V-type': 'Two banks share a crankshaft in a V.',
    Radial: 'Cylinders radiate around a central crankcase.',
    Opposed: 'Two horizontal banks face away from the crankcase.',
  };
  return <div className={panel}>
    {!fixed && <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{(['Inline', 'V-type', 'Radial', 'Opposed'] as Arrangement[]).map((kind) => <button key={kind} type="button" className={button} aria-pressed={selected === kind} onClick={() => setSelected(kind)}>{kind}</button>)}</div>}
    <div className="grid items-center gap-3 sm:grid-cols-[13rem_minmax(0,1fr)]"><ArrangementDiagram kind={selected} /><div><h3 className="font-bold text-white">{selected}</h3><p className="mt-1 text-xs leading-relaxed text-slate-300">{details[selected]}</p><p className="mt-3 text-[10px] text-slate-500">Geometry is simplified for recognition; installation details vary by engine.</p></div></div>
  </div>;
}

function IgnitionComparator() {
  const [method, setMethod] = useState<'spark' | 'compression'>('spark');
  const [position, setPosition] = useState(78);
  const beforeTdc = 100 - position;
  return <div className={panel}>
    <div className="flex gap-2"><button className={button} aria-pressed={method === 'spark'} onClick={() => setMethod('spark')}>Spark ignition</button><button className={button} aria-pressed={method === 'compression'} onClick={() => setMethod('compression')}>Compression ignition</button></div>
    <div className="mt-4 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div><label className="text-xs font-semibold text-slate-300" htmlFor="ignition-position">Piston position near compression TDC</label><input id="ignition-position" className="mt-2 w-full accent-teal-400" type="range" min="55" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} /><p className="mt-2 text-xs text-slate-300">{method === 'spark' ? `The spark is commanded about ${beforeTdc}° before the teaching TDC marker so combustion pressure can build.` : 'Highly compressed air reaches a temperature that ignites fuel injected near the end of compression.'}</p></div>
      <svg viewBox="0 0 180 125" role="img" aria-label={`${method} ignition diagram`} className="h-40 w-full rounded-lg bg-slate-950/50"><path d="M48 12h84v103H48z" fill="#0c2026" stroke="#55707a" strokeWidth="3" /><rect x="56" y={82 - position * .45} width="68" height="20" rx="4" fill="#94a3b8" /><path d="M90 13v20" stroke="#cbd5e1" strokeWidth="5" />{method === 'spark' ? <path d="M76 39l10 10 8-18 8 18 10-10" fill="none" stroke="#f59e0b" strokeWidth="4" /> : <path d="M66 42q24-25 48 0" fill="none" stroke="#fb923c" strokeWidth="8" opacity=".8" />}</svg>
    </div><p className="mt-2 text-[10px] text-slate-500">Conceptual comparison only; do not use it as an engine timing procedure.</p>
  </div>;
}

function CoolingExplorer() {
  const [flow, setFlow] = useState<'low' | 'high'>('high');
  const [baffles, setBaffles] = useState(true);
  const [clear, setClear] = useState(true);
  const effective = (flow === 'high' ? 2 : 1) + (baffles ? 1 : -1) + (clear ? 1 : -1);
  return <div className={panel}>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><button className={button} onClick={() => setFlow((v) => v === 'high' ? 'low' : 'high')}>Airflow: {flow}</button><button className={button} onClick={() => setBaffles((v) => !v)}>Baffles: {baffles ? 'sealed' : 'leaking'}</button><button className={button} onClick={() => setClear((v) => !v)}>Fins: {clear ? 'clear' : 'blocked'}</button></div>
    <svg viewBox="0 0 560 150" role="img" aria-label="Air cooling path" className="mt-3 h-40 w-full rounded-lg bg-slate-950/50">
      <defs><marker id="cool-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0l8 4-8 4z" fill="#67e8f9" /></marker></defs>
      <g stroke="#94a3b8" strokeWidth="8">{[0,1,2,3,4,5].map((i) => <path key={i} d={`M245 ${38+i*15}h75`} />)}</g><rect x="260" y="30" width="45" height="100" rx="12" fill="#475569" />
      {Array.from({ length: flow === 'high' ? 5 : 3 }, (_, i) => <path key={i} d={`M25 ${40+i*20}C140 ${35+i*19} 180 ${48+i*15} 240 ${48+i*15}S390 ${48+i*15} 520 ${44+i*18}`} fill="none" stroke={effective > 1 ? '#67e8f9' : '#64748b'} strokeWidth="4" strokeDasharray={clear ? undefined : '10 9'} markerEnd="url(#cool-arrow)" />)}
      {baffles && <path d="M215 25v105M335 25v105" stroke="#2dd4bf" strokeWidth="6" />}
    </svg>
    <p className={`mt-2 text-xs font-semibold ${effective > 2 ? 'text-teal-300' : effective > 0 ? 'text-amber-300' : 'text-rose-300'}`}>Cooling path: {effective > 2 ? 'strong and directed' : effective > 0 ? 'reduced' : 'seriously compromised'}</p>
  </div>;
}

function TurboEnergyPath() {
  const [wastegateOpen, setWastegateOpen] = useState(false);
  const flow = wastegateOpen ? 'Most exhaust bypasses the turbine; compressor drive falls.' : 'Exhaust is directed through the turbine; compressor delivery rises.';
  return <div className={panel}>
    <button className={button} aria-pressed={wastegateOpen} onClick={() => setWastegateOpen((value) => !value)}>Wastegate: {wastegateOpen ? 'open' : 'closed'}</button>
    <svg viewBox="0 0 640 190" role="img" aria-label="Turbocharger energy path" className="mt-3 h-48 w-full rounded-lg bg-slate-950/50">
      <defs><marker id="turbo-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0l8 4-8 4z" fill="currentColor" /></marker></defs>
      <g fontSize="15" textAnchor="middle"><circle cx="270" cy="95" r="42" fill="#132b31" stroke="#fb923c" strokeWidth="4" /><text x="270" y="100" fill="#fff">Turbine</text><circle cx="385" cy="95" r="42" fill="#132b31" stroke="#67e8f9" strokeWidth="4" /><text x="385" y="100" fill="#fff">Compressor</text><path d="M312 95h31" stroke="#cbd5e1" strokeWidth="8" /></g>
      <path d="M30 65h195" fill="none" stroke="#fb923c" strokeWidth={wastegateOpen ? 4 : 9} markerEnd="url(#turbo-arrow)" className="motion-safe:animate-pulse" /><text x="105" y="50" fill="#fdba74" fontSize="13">exhaust energy</text>
      <path d="M25 145h195Q260 145 260 128" fill="none" stroke="#fb923c" strokeWidth={wastegateOpen ? 9 : 3} markerEnd="url(#turbo-arrow)" /><text x="105" y="170" fill="#94a3b8" fontSize="12">wastegate bypass</text>
      <path d="M430 95h175" fill="none" stroke="#67e8f9" strokeWidth={wastegateOpen ? 4 : 9} markerEnd="url(#turbo-arrow)" className="motion-safe:animate-pulse" /><text x="520" y="78" fill="#a5f3fc" fontSize="13">compressed induction air</text>
    </svg><p className="mt-2 text-xs text-slate-300">{flow}</p><p className="mt-1 text-[10px] text-slate-500">Conceptual flow only; control schedules and limits are installation-specific.</p>
  </div>;
}

function AltitudeComparator() {
  const [altitude, setAltitude] = useState(8000);
  const ambient = Math.max(11, 30 - altitude / 1050);
  const normalized = altitude <= 12000 ? 29 : Math.max(14, 29 - (altitude - 12000) / 900);
  const boosted = altitude <= 16000 ? 35 : Math.max(18, 35 - (altitude - 16000) / 750);
  const values = [{ name: 'Naturally aspirated', value: ambient, color: '#94a3b8' }, { name: 'Normalizing turbo', value: normalized, color: '#2dd4bf' }, { name: 'Ground-boosted', value: boosted, color: '#f59e0b' }];
  return <div className={panel}>
    <label htmlFor="altitude" className="text-xs font-semibold text-white">Altitude: {altitude.toLocaleString()} ft</label><input id="altitude" className="mt-2 w-full accent-teal-400" type="range" min="0" max="20000" step="500" value={altitude} onChange={(event) => setAltitude(Number(event.target.value))} />
    <div className="mt-4 space-y-2">{values.map((item) => <div key={item.name} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-2 text-[11px]"><span className="text-slate-300">{item.name}</span><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full transition-[width]" style={{ width: `${item.value / 40 * 100}%`, backgroundColor: item.color }} /></div><span className="font-mono text-slate-300">{item.value.toFixed(0)}</span></div>)}</div>
    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Schematic comparison — not engine performance data</p>
  </div>;
}

function SteamSchematic() {
  return <div className={panel}><svg viewBox="0 0 720 260" role="img" aria-label="Simplified external-combustion steam engine" className="h-56 w-full rounded-lg bg-slate-950/50"><defs><marker id="steam-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0l8 4-8 4z" fill="#67e8f9" /></marker></defs><g stroke="#94a3b8" strokeWidth="4" fill="#132b31"><rect x="35" y="70" width="150" height="125" rx="40" /><rect x="285" y="50" width="150" height="145" rx="8" /><circle cx="600" cy="123" r="75" /></g><path d="M110 195v30M70 225h80" stroke="#fb923c" strokeWidth="8" /><path d="M180 94h105" stroke="#67e8f9" strokeWidth="8" markerEnd="url(#steam-arrow)" /><rect x="302" y="80" width="115" height="35" rx="4" fill="#94a3b8" /><path d="M360 115v92h165l40-45" fill="none" stroke="#cbd5e1" strokeWidth="10" /><circle cx="600" cy="123" r="16" fill="#2dd4bf" /><g fill="#e2e8f0" fontSize="18" textAnchor="middle"><text x="110" y="135">Boiler</text><text x="360" y="35">Cylinder</text><text x="600" y="35">Flywheel</text></g><text x="105" y="248" fill="#fdba74" fontSize="16" textAnchor="middle">external furnace</text></svg><p className="mt-2 text-xs text-slate-300">Combustion heats a separate boiler; steam then drives the piston and crank/flywheel.</p></div>;
}

function PistonCrank() {
  const [angle, setAngle] = useState(35);
  const rad = angle * Math.PI / 180;
  const crankX = 320 + Math.cos(rad) * 48;
  const crankY = 170 + Math.sin(rad) * 48;
  const pistonY = 40 + (1 - Math.cos(rad)) * 45;
  return <div className={panel}><input aria-label="Rotate the crankshaft" className="w-full accent-teal-400" type="range" min="0" max="360" value={angle} onChange={(event) => setAngle(Number(event.target.value))} /><svg viewBox="0 0 640 250" role="img" aria-label="Piston, connecting rod and crankshaft motion" className="mt-2 h-56 w-full rounded-lg bg-slate-950/50"><path d="M225 18h190v160H225z" fill="#0c2026" stroke="#55707a" strokeWidth="4" /><rect x="245" y={pistonY} width="150" height="44" rx="8" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="3" /><path d={`M320 ${pistonY + 44}L${crankX} ${crankY}`} stroke="#cbd5e1" strokeWidth="18" strokeLinecap="round" /><circle cx="320" cy="170" r="48" fill="none" stroke="#2dd4bf" strokeWidth="5" /><circle cx={crankX} cy={crankY} r="12" fill="#f59e0b" /><path d="M190 222h260" stroke="#64748b" strokeWidth="12" /><g fill="#e2e8f0" fontSize="16"><text x="430" y="65">Piston: reciprocating</text><text x="430" y="170">Crank: rotating</text></g></svg><p className="mt-2 text-xs text-slate-300">Drag the crank angle to see rotary motion converted to piston travel through the connecting rod.</p></div>;
}

export const lessonArtifactIds = [
  'cycle-phase-scrubber', 'two-stroke-port-timing', 'arrangement-comparator', 'ignition-method-comparator',
  'air-cooling-path-explorer', 'turbocharger-energy-path', 'aspiration-altitude-comparator',
  'steam-engine-schematic', 'otto-cycle-overview', 'piston-crank-converter', 'arrangement-inline', 'arrangement-v',
] as const;

export const LessonArtifact: React.FC<ArtifactProps> = ({ id }) => {
  const content = useMemo(() => {
    if (id === 'cycle-phase-scrubber' || id === 'otto-cycle-overview') return <CycleScrubber />;
    if (id === 'two-stroke-port-timing') return <TwoStrokeTiming />;
    if (id === 'arrangement-comparator') return <ArrangementComparator />;
    if (id === 'arrangement-inline') return <ArrangementComparator fixed="Inline" />;
    if (id === 'arrangement-v') return <ArrangementComparator fixed="V-type" />;
    if (id === 'ignition-method-comparator') return <IgnitionComparator />;
    if (id === 'air-cooling-path-explorer') return <CoolingExplorer />;
    if (id === 'turbocharger-energy-path') return <TurboEnergyPath />;
    if (id === 'aspiration-altitude-comparator') return <AltitudeComparator />;
    if (id === 'steam-engine-schematic') return <SteamSchematic />;
    if (id === 'piston-crank-converter') return <PistonCrank />;
    return <div className={panel}><p className="text-xs text-slate-300">This learning activity is not available.</p></div>;
  }, [id]);
  return <div className="w-full">{content}</div>;
};
