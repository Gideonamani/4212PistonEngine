import React, { useState } from 'react';
import { camLift, openingWindow, PEAK_CRANK, type LobeProfile } from './valveTrain.mjs';

/**
 * Native lesson interactives for lesson 9 (Valve Operating). Schematic: the lobe shapes are drawn to teach what a cam does, not taken
 * from any engine's cam data. The "standard" duration is the intake valve of the FAA handbook's example timing chart (Figure 1-37).
 */

const panel = 'rounded-xl border border-teal-500/20 bg-[#061418] p-3 text-slate-100';
const button = 'rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400 aria-pressed:border-teal-400 aria-pressed:bg-teal-500/15 aria-pressed:text-teal-200';
const caption = 'mt-2 text-[11px] text-slate-400';

type Profile = LobeProfile & { id: string; label: string };

// Lift is in relative units, not millimetres. All three lobes open the valve around the middle of the intake stroke.
const PROFILES: Profile[] = [
  { id: 'short', label: 'Low lift, short duration', lift: 7, durationCrank: 220, rampFraction: 0.14, rampCrank: 36 },
  { id: 'standard', label: 'Standard', lift: 10, durationCrank: 260, rampFraction: 0.14, rampCrank: 36 },
  { id: 'long', label: 'High lift, long duration', lift: 13, durationCrank: 300, rampFraction: 0.14, rampCrank: 36 },
];

const CAM_CENTRE = { x: 110, y: 122 };
const BASE_RADIUS = 40;
const CAM_SCALE = 3; // pixels of lobe per lift unit on the cam
const GRAPH_SCALE = 8; // pixels of height per lift unit on the graph

const GRAPH = { left: 250, right: 628, top: 40, bottom: 152 };
const graphX = (crank: number) => GRAPH.left + (crank / 720) * (GRAPH.right - GRAPH.left);
const graphY = (lift: number) => GRAPH.bottom - lift * GRAPH_SCALE;

function lobePath(profile: Profile, camAngle: number) {
  // Screen angles run clockwise from the right-hand side, so -90 is straight up, where the tappet sits. The nose is under the tappet
  // when the crank is at its peak angle, and the cam turns clockwise: a point on the lobe that is `fromNose` degrees clockwise of the
  // nose reaches the tappet 2 x fromNose crank degrees before the nose does.
  const nose = -90 + (camAngle - PEAK_CRANK / 2);
  const points: string[] = [];
  for (let fromNose = -180; fromNose < 180; fromNose += 2) {
    const radius = BASE_RADIUS + camLift(profile, PEAK_CRANK - 2 * fromNose) * CAM_SCALE;
    const screen = ((nose + fromNose) * Math.PI) / 180;
    points.push(`${(CAM_CENTRE.x + radius * Math.cos(screen)).toFixed(1)},${(CAM_CENTRE.y + radius * Math.sin(screen)).toFixed(1)}`);
  }
  return `M${points.join('L')}Z`;
}

export function CamLiftDiagram() {
  const [crank, setCrank] = useState(PEAK_CRANK);
  const [profileId, setProfileId] = useState('standard');
  const profile = PROFILES.find((item) => item.id === profileId) ?? PROFILES[1];
  const lift = camLift(profile, crank);
  const open = lift > 0;
  const camAngle = crank / 2;
  const tappetY = CAM_CENTRE.y - BASE_RADIUS - lift * CAM_SCALE;
  const curve = Array.from({ length: 181 }, (_, index) => {
    const angle = index * 4;
    return `${graphX(angle).toFixed(1)},${graphY(camLift(profile, angle)).toFixed(1)}`;
  }).join(' ');
  const { opens, closes } = openingWindow(profile);
  const windows: [number, number][] = opens < closes ? [[opens, closes]] : [[opens, 720], [0, closes]];
  const strokes = [{ name: 'Intake', from: 0 }, { name: 'Compression', from: 180 }, { name: 'Power', from: 360 }, { name: 'Exhaust', from: 540 }];

  return <div className={panel}>
    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Lobe shape">
      {PROFILES.map((item) => <button key={item.id} type="button" aria-pressed={item.id === profileId} onClick={() => setProfileId(item.id)} className={`${button} min-h-11`}>{item.label}</button>)}
    </div>
    <svg viewBox="0 0 640 224" role="img" aria-label={`A cam lobe turning under a tappet beside a graph of valve lift against crank angle. The valve is ${open ? 'open' : 'closed'} at ${crank} degrees.`} className="w-full rounded-lg bg-slate-950/50">
      <path d={lobePath(profile, camAngle)} fill="#0f3a44" stroke="#2dd4bf" strokeWidth="2" />
      <circle cx={CAM_CENTRE.x} cy={CAM_CENTRE.y} r="5" fill="#94a3b8" />
      <circle cx={CAM_CENTRE.x} cy={CAM_CENTRE.y} r={BASE_RADIUS} fill="none" stroke="#475569" strokeDasharray="3 4" />
      <rect x={CAM_CENTRE.x - 11} y={tappetY - 16} width="22" height="16" rx="3" fill={open ? '#f59e0b' : '#94a3b8'} stroke="#e2e8f0" />
      <path d={`M${CAM_CENTRE.x} ${tappetY - 16}V10`} stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      <text x={CAM_CENTRE.x + 18} y="22" fontSize="12" fill="#cbd5e1">to pushrod</text>
      <text x={CAM_CENTRE.x} y="218" fontSize="12" fill="#94a3b8" textAnchor="middle">cam turns at half crank speed</text>

      <g>
        {strokes.map((stroke, index) => <g key={stroke.name}><rect x={graphX(stroke.from)} y={GRAPH.bottom + 6} width={graphX(180) - graphX(0)} height="20" fill={index % 2 ? '#132b31' : '#0e2228'} stroke="#1e3a42" /><text x={graphX(stroke.from + 90)} y={GRAPH.bottom + 20} fontSize="11" fill="#94a3b8" textAnchor="middle">{stroke.name}</text></g>)}
        {windows.map(([from, to]) => <rect key={from} x={graphX(from)} y={GRAPH.top - 6} width={graphX(to) - graphX(from)} height={GRAPH.bottom - GRAPH.top + 6} fill="#2dd4bf" opacity=".12" />)}
        <path d={`M${GRAPH.left} ${GRAPH.bottom}H${GRAPH.right}`} stroke="#64748b" />
        <polyline points={curve} fill="none" stroke="#2dd4bf" strokeWidth="2.5" />
        <path d={`M${graphX(crank)} ${GRAPH.top - 8}V${GRAPH.bottom}`} stroke="#f8fafc" strokeWidth="2" />
        <circle cx={graphX(crank)} cy={graphY(lift)} r="5" fill={open ? '#f59e0b' : '#94a3b8'} stroke="#f8fafc" />
        <text x={GRAPH.left - 8} y={graphY(profile.lift) + 4} fontSize="11" fill="#94a3b8" textAnchor="end">lift</text>
        <text x={graphX(PEAK_CRANK)} y={GRAPH.top - 12} fontSize="11" fill="#99f6e4" textAnchor="middle">valve open: {profile.durationCrank}° of crank</text>
        <text x={GRAPH.left} y={GRAPH.bottom + 38} fontSize="11" fill="#94a3b8">0°</text>
        <text x={GRAPH.right} y={GRAPH.bottom + 38} fontSize="11" fill="#94a3b8" textAnchor="end">720°</text>
      </g>
    </svg>
    <input aria-label="Crank angle" className="mt-1 h-11 w-full accent-teal-400" type="range" min="0" max="719" value={crank} onChange={(event) => setCrank(Number(event.target.value))} />
    <p className="mt-2 text-xs text-slate-300"><strong className="text-white">Crank {crank}° · cam {Math.round(camAngle)}°.</strong> {open ? <>The lobe is lifting the tappet by {lift.toFixed(1)} units: the valve is <strong className="text-white">open</strong>.</> : <>The tappet rides the base circle: the valve is <strong className="text-white">closed</strong> and its spring holds it on the seat.</>}</p>
    <p className="mt-1 text-[11px] text-slate-300">Lift {profile.lift} units at most · opens for {profile.durationCrank}° of crank rotation ({profile.durationCrank / 2}° of cam rotation) · gentle ramps on each flank ease the follower on and off.</p>
    <p className={caption}>Schematic lobe, lift in relative units (not millimetres). The standard duration matches the intake valve of the FAA handbook&apos;s example timing chart; real lobes are in the engine manufacturer&apos;s data.</p>
  </div>;
}
