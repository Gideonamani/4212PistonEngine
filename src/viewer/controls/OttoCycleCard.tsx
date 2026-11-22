import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  cycleMeta,
  cycleState,
  sampleCycle,
  sampleReferenceCycle,
} from '../engineering/cycle-model.mjs';

export type CycleMode = 'ideal' | 'practical';
export type CycleType = 'otto' | 'diesel' | 'two-stroke';
export type PlotView = 'both' | 'pv' | 'ts';

const PV_PLOT = { w: 260, h: 158, left: 26, right: 10, top: 12, bottom: 24 };
const TS_PLOT = { w: 260, h: 158, left: 26, right: 10, top: 12, bottom: 24 };

const STROKE_VAR = [
  'var(--color-cyan-300)',
  'var(--color-sky-400)',
  'var(--color-orange-400)',
  'var(--color-slate-400)',
];

function polylinePath(points: { x: number; y: number }[], close = false) {
  if (!points.length) return '';
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}${close ? ' Z' : ''}`;
}

/** Find the sample whose projected SVG coordinates are closest to the pointer (bidirectional chart scrubbing). */
function nearestSampleAngle(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  samples: { angle: number; sx: number; sy: number }[],
) {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return undefined;
  const vb = svg.viewBox.baseVal;
  const x = ((clientX - rect.left) / rect.width) * vb.width;
  const y = ((clientY - rect.top) / rect.height) * vb.height;
  let best = samples[0]?.angle ?? 0;
  let bestDist = Infinity;
  for (const s of samples) {
    const d = (s.sx - x) * (s.sx - x) + (s.sy - y) * (s.sy - y);
    if (d < bestDist) {
      bestDist = d;
      best = s.angle;
    }
  }
  return best;
}

/** Shared live Otto/Diesel state + pre-sampled curves for both MotionPanel and CycleSplitPane. */
export function useOttoData(angle: number, mode: CycleMode, cycleType: CycleType = 'otto') {
  const meta = useMemo(() => cycleMeta(cycleType), [cycleType]);
  const idealRef = useMemo(() => sampleReferenceCycle(cycleType), [cycleType]);
  const sampled = useMemo(() => sampleCycle(mode, cycleType, 2), [mode, cycleType]);
  const live = useMemo(() => cycleState(angle, mode, cycleType), [angle, mode, cycleType]);
  const workPct = Math.round((sampled.netWork / idealRef.netWork) * 100);
  return { meta, idealRef, sampled, live, workPct };
}

type OttoChartsProps = {
  angle: number;
  mode: CycleMode;
  cycleType?: CycleType;
  plotView: PlotView;
  onSeekAngle: (angle: number) => void;
  sideBySide?: boolean;
  className?: string;
};

/**
 * Interactive P–V and T–s SVG diagrams synced bidirectionally with the 3D cylinder crank angle.
 * Supports stacked mode (Motion drawer) and side-by-side 2-column mode (Cycle Split cockpit).
 */
export function OttoCharts({ angle, mode, cycleType = 'otto', plotView, onSeekAngle, sideBySide = false, className = '' }: OttoChartsProps) {
  const { meta, idealRef, sampled, live } = useOttoData(angle, mode, cycleType);
  const compRatio = meta.compressionRatio;

  // Fixed shared scales per cycleType so toggling Ideal <-> Practical shows exact peak & area changes without rescaling axes.
  const practicalRefPeakP = useMemo(() => {
    const pSample = sampleCycle('practical', cycleType, 4);
    let maxVal = idealRef.corners[3].pressure;
    for (const s of pSample.samples) if (s.pressure > maxVal) maxVal = s.pressure;
    return maxVal;
  }, [cycleType, idealRef]);
  const maxP = practicalRefPeakP * 1.08;
  const maxT = idealRef.corners[3].temperature * 1.12;
  const minS = -0.25;
  const maxS = idealRef.corners[3].entropy * 1.15;
  const minV = 1 - (compRatio - 1) * 0.055;
  const maxV = compRatio + (compRatio - 1) * 0.07;

  const pvX = (v: number) => PV_PLOT.left + ((v - minV) / (maxV - minV)) * (PV_PLOT.w - PV_PLOT.left - PV_PLOT.right);
  const pvY = (p: number) => PV_PLOT.h - PV_PLOT.bottom - (Math.max(0, p) / maxP) * (PV_PLOT.h - PV_PLOT.bottom - PV_PLOT.top);

  const tsX = (s: number) => TS_PLOT.left + ((s - minS) / (maxS - minS)) * (TS_PLOT.w - TS_PLOT.left - TS_PLOT.right);
  const tsY = (t: number) => TS_PLOT.h - TS_PLOT.bottom - ((Math.max(0.5, t) - 0.5) / (maxT - 0.5)) * (TS_PLOT.h - TS_PLOT.bottom - TS_PLOT.top);

  const idealPvPath = useMemo(
    () => polylinePath(idealRef.points.map((p) => ({ x: pvX(p.volume), y: pvY(p.pressure) })), true),
    [idealRef, maxP, minV, maxV],
  );
  const idealTsPath = useMemo(
    () => polylinePath(idealRef.points.map((p) => ({ x: tsX(p.entropy), y: tsY(p.temperature) })), true),
    [idealRef, maxT, maxS],
  );

  const projected = useMemo(() => {
    const pvAll = sampled.samples.map((s) => ({ angle: s.angle, strokeIndex: s.strokeIndex, sx: pvX(s.volume), sy: pvY(s.pressure) }));
    const tsAll = sampled.samples.map((s) => ({ angle: s.angle, strokeIndex: s.strokeIndex, sx: tsX(s.entropy), sy: tsY(s.temperature) }));
    const pvPower = sampled.powerSamples.map((s) => ({ x: pvX(s.volume), y: pvY(s.pressure) }));
    const pvPumping = sampled.pumpingSamples.map((s) => ({ x: pvX(s.volume), y: pvY(s.pressure) }));
    const byStroke = (list: typeof pvAll) => [0, 1, 2, 3].map((idx) => {
      const seg = list.filter((item) => item.strokeIndex === idx);
      const nextFirst = list.find((item) => item.strokeIndex === (idx + 1) % 4);
      const pts = nextFirst ? [...seg, nextFirst] : seg;
      return polylinePath(pts.map((p) => ({ x: p.sx, y: p.sy })), false);
    });
    return {
      pvAll,
      tsAll,
      pvPowerFill: polylinePath(pvPower, true),
      pvPumpingFill: polylinePath(pvPumping, true),
      pvStrokePaths: byStroke(pvAll),
      tsStrokePaths: byStroke(tsAll),
    };
  }, [sampled, maxP, maxT, maxS, minV, maxV]);

  const eventSample = useMemo(() => cycleState(meta.eventAngleDeg, 'practical', cycleType), [meta.eventAngleDeg, cycleType]);
  const liveColor = STROKE_VAR[live.strokeIndex];
  const livePv = { x: pvX(live.volume), y: pvY(live.pressure) };
  const liveTs = { x: tsX(live.entropy), y: tsY(live.temperature) };

  const pvSvgRef = useRef<SVGSVGElement>(null);
  const tsSvgRef = useRef<SVGSVGElement>(null);

  const makeScrubHandlers = (
    ref: React.RefObject<SVGSVGElement | null>,
    samples: { angle: number; sx: number; sy: number }[],
  ) => ({
    onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      const next = ref.current ? nearestSampleAngle(event.clientX, event.clientY, ref.current, samples) : undefined;
      if (next !== undefined) onSeekAngle(next);
    },
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const next = ref.current ? nearestSampleAngle(event.clientX, event.clientY, ref.current, samples) : undefined;
      if (next !== undefined) onSeekAngle(next);
    },
  });

  const pvScrub = makeScrubHandlers(pvSvgRef, projected.pvAll);
  const tsScrub = makeScrubHandlers(tsSvgRef, projected.tsAll);

  const showPv = plotView === 'both' || plotView === 'pv';
  const showTs = plotView === 'both' || plotView === 'ts';
  const twoCol = sideBySide && showPv && showTs;

  const svgClass = sideBySide
    ? 'h-full w-full min-h-0 touch-none select-none rounded-lg border border-white/10 bg-slate-950/60 cursor-crosshair'
    : 'w-full touch-none select-none rounded-lg bg-slate-950/60 cursor-crosshair';

  return <div className={`${twoCol ? 'grid grid-cols-2 gap-1.5' : 'flex flex-col gap-2'} ${className}`}>
    {showPv && (
      <svg
        ref={pvSvgRef}
        viewBox={`0 0 ${PV_PLOT.w} ${PV_PLOT.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Live ${mode} ${meta.name} cycle pressure-volume diagram at ${Math.round(angle)} degrees. Tap or drag to move piston.`}
        className={svgClass}
        {...pvScrub}
      >
        <path d={`M${PV_PLOT.left} ${PV_PLOT.top}V${PV_PLOT.h - PV_PLOT.bottom}H${PV_PLOT.w - PV_PLOT.right}`} stroke="var(--color-slate-500)" strokeWidth="1.2" fill="none" />
        <line x1={pvX(1)} y1={PV_PLOT.top} x2={pvX(1)} y2={PV_PLOT.h - PV_PLOT.bottom} stroke="var(--color-outline-soft)" strokeDasharray="3 3" strokeWidth="1" />
        <line x1={pvX(compRatio)} y1={PV_PLOT.top} x2={pvX(compRatio)} y2={PV_PLOT.h - PV_PLOT.bottom} stroke="var(--color-outline-soft)" strokeDasharray="3 3" strokeWidth="1" />
        <line x1={PV_PLOT.left} y1={pvY(1)} x2={PV_PLOT.w - PV_PLOT.right} y2={pvY(1)} stroke="var(--color-slate-600)" strokeDasharray="2 3" strokeWidth="1" />

        {mode === 'practical' && (
          <path d={idealPvPath} fill="none" stroke="var(--color-slate-500)" strokeWidth="1.3" strokeDasharray="4 3" />
        )}

        <path d={mode === 'ideal' ? idealPvPath : projected.pvPowerFill} fill="var(--color-teal-400)" fillOpacity="0.11" stroke="none" />
        {mode === 'practical' && (
          <path d={projected.pvPumpingFill} fill="var(--color-rose-400)" fillOpacity="0.22" stroke="none" />
        )}

        {mode === 'ideal' ? (
          <path d={idealPvPath} fill="none" stroke="var(--color-teal-400)" strokeWidth="2" />
        ) : (
          projected.pvStrokePaths.map((d, idx) => (
            <path key={idx} d={d} fill="none" stroke={STROKE_VAR[idx]} strokeWidth={idx === live.strokeIndex ? 2.6 : 1.7} strokeOpacity={idx === live.strokeIndex ? 1 : 0.72} />
          ))
        )}

        {mode === 'practical' && (
          <g>
            <circle cx={pvX(eventSample.volume)} cy={pvY(eventSample.pressure)} r="3.2" fill="var(--color-amber-300)" />
            <text x={pvX(eventSample.volume) + 5} y={pvY(eventSample.pressure) + 3} fontSize="8" fill="var(--color-amber-300)" fontWeight="600">{meta.eventLabel}</text>
          </g>
        )}

        <g fontSize="8.5" fill="var(--color-slate-400)" fontWeight="700">
          <text x={pvX(idealRef.corners[1].volume) + 3} y={pvY(idealRef.corners[1].pressure) - 3}>1</text>
          <text x={pvX(idealRef.corners[2].volume) - 9} y={pvY(idealRef.corners[2].pressure) + 3}>2</text>
          <text x={pvX(idealRef.corners[3].volume) + (cycleType === 'diesel' ? 4 : -9)} y={pvY(idealRef.corners[3].pressure) + (cycleType === 'diesel' ? 3 : 7)}>3</text>
          <text x={pvX(idealRef.corners[4].volume) + 3} y={pvY(idealRef.corners[4].pressure) - 2}>4</text>
        </g>

        <line x1={livePv.x} y1={livePv.y} x2={livePv.x} y2={PV_PLOT.h - PV_PLOT.bottom} stroke={liveColor} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.6" />
        <line x1={PV_PLOT.left} y1={livePv.y} x2={livePv.x} y2={livePv.y} stroke={liveColor} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.6" />
        <circle cx={livePv.x} cy={livePv.y} r="7.5" fill={liveColor} fillOpacity="0.25" />
        <circle cx={livePv.x} cy={livePv.y} r="4.2" fill={liveColor} stroke="var(--color-white)" strokeWidth="1.5" />

        <g fontSize="8.5" fill="var(--color-slate-400)">
          <text x={pvX(1)} y={PV_PLOT.h - 11} textAnchor="middle">TDC</text>
          <text x={pvX(compRatio)} y={PV_PLOT.h - 11} textAnchor="middle">BDC</text>
          <text x={(PV_PLOT.left + PV_PLOT.w - PV_PLOT.right) / 2} y={PV_PLOT.h - 2} textAnchor="middle">Volume (V) →</text>
          <text transform={`translate(9 ${PV_PLOT.h / 2}) rotate(-90)`} textAnchor="middle">Pressure (P) →</text>
          <text x={PV_PLOT.w - PV_PLOT.right - 2} y={PV_PLOT.top + 8} textAnchor="end" fontWeight="700" fill="var(--color-slate-300)">P–V</text>
        </g>
      </svg>
    )}

    {showTs && (
      <svg
        ref={tsSvgRef}
        viewBox={`0 0 ${TS_PLOT.w} ${TS_PLOT.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Live ${mode} ${meta.name} cycle temperature-entropy diagram at ${Math.round(angle)} degrees. Tap or drag to move piston.`}
        className={svgClass}
        {...tsScrub}
      >
        <path d={`M${TS_PLOT.left} ${TS_PLOT.top}V${TS_PLOT.h - TS_PLOT.bottom}H${TS_PLOT.w - TS_PLOT.right}`} stroke="var(--color-slate-500)" strokeWidth="1.2" fill="none" />
        <line x1={tsX(0)} y1={TS_PLOT.top} x2={tsX(0)} y2={TS_PLOT.h - TS_PLOT.bottom} stroke="var(--color-outline-soft)" strokeDasharray="3 3" strokeWidth="1" />

        {mode === 'practical' && (
          <path d={idealTsPath} fill="none" stroke="var(--color-slate-500)" strokeWidth="1.3" strokeDasharray="4 3" />
        )}

        {mode === 'ideal' ? (
          <path d={idealTsPath} fill="var(--color-teal-400)" fillOpacity="0.1" stroke="var(--color-teal-400)" strokeWidth="2" />
        ) : (
          projected.tsStrokePaths.map((d, idx) => (
            <path key={idx} d={d} fill="none" stroke={STROKE_VAR[idx]} strokeWidth={idx === live.strokeIndex ? 2.6 : 1.7} strokeOpacity={idx === live.strokeIndex ? 1 : 0.72} />
          ))
        )}

        <g fontSize="8.5" fill="var(--color-slate-400)" fontWeight="700">
          <text x={tsX(idealRef.corners[1].entropy) - 9} y={tsY(idealRef.corners[1].temperature) + 3}>1</text>
          <text x={tsX(idealRef.corners[2].entropy) - 9} y={tsY(idealRef.corners[2].temperature) + 3}>2</text>
          <text x={tsX(idealRef.corners[3].entropy) + 4} y={tsY(idealRef.corners[3].temperature) + 4}>3</text>
          <text x={tsX(idealRef.corners[4].entropy) + 4} y={tsY(idealRef.corners[4].temperature) + 3}>4</text>
        </g>

        <line x1={liveTs.x} y1={liveTs.y} x2={liveTs.x} y2={TS_PLOT.h - TS_PLOT.bottom} stroke={liveColor} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.6" />
        <line x1={TS_PLOT.left} y1={liveTs.y} x2={liveTs.x} y2={liveTs.y} stroke={liveColor} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.6" />
        <circle cx={liveTs.x} cy={liveTs.y} r="7.5" fill={liveColor} fillOpacity="0.25" />
        <circle cx={liveTs.x} cy={liveTs.y} r="4.2" fill={liveColor} stroke="var(--color-white)" strokeWidth="1.5" />

        <g fontSize="8.5" fill="var(--color-slate-400)">
          <text x={(TS_PLOT.left + TS_PLOT.w - TS_PLOT.right) / 2} y={TS_PLOT.h - 2} textAnchor="middle">Entropy (s) →</text>
          <text transform={`translate(9 ${TS_PLOT.h / 2}) rotate(-90)`} textAnchor="middle">Temp (T) →</text>
          <text x={TS_PLOT.w - TS_PLOT.right - 2} y={TS_PLOT.top + 8} textAnchor="end" fontWeight="700" fill="var(--color-slate-300)">T–s</text>
        </g>
      </svg>
    )}
  </div>;
}

type OttoCycleCardProps = {
  angle: number;
  mode: CycleMode;
  cycleType?: CycleType;
  onModeChange: (mode: CycleMode) => void;
  onSeekAngle: (angle: number) => void;
  compact?: boolean;
};

/**
 * Synchronized Otto / Diesel Cycle P–V and T–s monitor embedded inside the Motion tab.
 */
export function OttoCycleCard({ angle, mode, cycleType = 'otto', onModeChange, onSeekAngle, compact = false }: OttoCycleCardProps) {
  const [plotView, setPlotView] = useState<PlotView>(compact ? 'pv' : 'both');
  const { meta, live, workPct } = useOttoData(angle, mode, cycleType);

  return <div className="space-y-2.5 rounded-xl border border-teal-500/20 bg-inset p-2.5 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-1.5">
      <div role="radiogroup" aria-label={`${meta.name} cycle model`} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950/50 p-0.5">
        {(['ideal', 'practical'] as CycleMode[]).map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={mode === item}
            onClick={() => onModeChange(item)}
            className={`min-h-8 rounded-md px-2.5 text-[11px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${mode === item ? 'bg-teal-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'}`}
          >
            {item === 'ideal' ? 'Ideal' : 'Practical'}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Thermodynamic diagram" className="flex items-center gap-1 rounded-lg bg-slate-950/50 p-0.5">
        {(['pv', 'ts', 'both'] as PlotView[]).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={plotView === view}
            onClick={() => setPlotView(view)}
            className={`min-h-8 rounded-md px-2 text-[11px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${plotView === view ? 'bg-white/15 text-teal-200' : 'text-slate-400 hover:text-white'}`}
          >
            {view === 'pv' ? 'P–V' : view === 'ts' ? 'T–s' : 'Both'}
          </button>
        ))}
      </div>
    </div>

    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="truncate font-semibold text-white">{live.processLabel}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${mode === 'practical' ? 'bg-amber-400/15 text-amber-300' : 'bg-teal-400/15 text-teal-300'}`}>
        Work {workPct}%
      </span>
    </div>

    <OttoCharts angle={angle} mode={mode} cycleType={cycleType} plotView={plotView} onSeekAngle={onSeekAngle} />

    {!compact && (
      <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
        <div className="rounded-lg bg-slate-950/50 px-1.5 py-1">
          <div className="text-slate-400">Vol</div>
          <div className="font-bold text-white">{live.volume.toFixed(1)}× Vc</div>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-1.5 py-1">
          <div className="text-slate-400">Press</div>
          <div className="font-bold text-teal-300">{live.pressure.toFixed(1)}× P₁</div>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-1.5 py-1">
          <div className="text-slate-400">Temp</div>
          <div className="font-bold text-amber-300">{live.temperature.toFixed(1)}× T₁</div>
        </div>
      </div>
    )}

    <p className="text-[11px] leading-relaxed text-slate-300">{live.explanation}</p>
    {!compact && (
      <p className="text-[10px] leading-snug text-slate-400">{meta.provenance}</p>
    )}
  </div>;
}

/**
 * Collapsible floating live Otto/Diesel P–V / T–s card over the 3D stage (when drawer is hidden and not in Cycle Split mode).
 */
export function FloatingOttoOverlay({
  angle,
  mode,
  cycleType = 'otto',
  onModeChange,
  onSeekAngle,
}: {
  angle: number;
  mode: CycleMode;
  cycleType?: CycleType;
  onModeChange: (mode: CycleMode) => void;
  onSeekAngle: (angle: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const live = useMemo(() => cycleState(angle, mode, cycleType), [angle, mode, cycleType]);
  const meta = useMemo(() => cycleMeta(cycleType), [cycleType]);

  return <div
    aria-label={`Live ${meta.name} cycle overlay`}
    className="absolute left-3 top-3 z-20 w-56 max-w-[calc(100%-5.5rem)] rounded-2xl border border-teal-500/30 bg-panel/92 shadow-2xl backdrop-blur-md sm:w-64"
  >
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded-2xl"
    >
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-bold tracking-wider text-teal-300">{meta.name.toUpperCase()} · {mode.toUpperCase()}</div>
        <div className="truncate text-[11px] font-semibold text-white">{live.stroke} · {Math.round(angle)}°</div>
      </div>
      {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
    </button>
    {expanded && (
      <div className="px-2 pb-2">
        <OttoCycleCard angle={angle} mode={mode} cycleType={cycleType} onModeChange={onModeChange} onSeekAngle={onSeekAngle} compact />
      </div>
    )}
  </div>;
}
