import React from 'react';
import { Sparkles } from 'lucide-react';
import type { SectionAxis } from '../types';
import type { ModelViewerState } from '../useModelViewer';

/**
 * The cross-section card: a switch that cuts the model open, the plane to cut along, and a slider that moves the cut. The chips are the
 * three standard planes X, Y and Z, plus R when the lesson step recommends a plane of its own (its name, such as "Valve axis", is
 * given in the line under the chips). Explore adds Reverse cut and Reset.
 */

const AXES: SectionAxis[] = ['x', 'y', 'z'];
type PlaneId = SectionAxis | 'recommended';

/** A small cube with the plane drawn through it, so the three standard planes read at a glance. */
const PLANE_POLYGON: Record<SectionAxis, string> = {
  x: '10.8,13.5 21.2,7.5 21.2,19.5 10.8,25.5',
  y: '21.2,13.5 10.8,7.5 10.8,19.5 21.2,25.5',
  z: '16,22.5 26.4,16.5 16,10.5 5.6,16.5',
};
const PlaneGlyph: React.FC<{ axis: SectionAxis }> = ({ axis }) => (
  <svg width="23" height="23" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <polygon points="16,4.5 26.4,10.5 26.4,22.5 16,28.5 5.6,22.5 5.6,10.5" fill="none" stroke="#8399a0" strokeWidth="1.3" strokeLinejoin="round" />
    <polygon points={PLANE_POLYGON[axis]} fill="rgba(45,212,191,.38)" stroke="#5eead4" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const secondary = 'min-h-11 rounded-xl bg-white/5 px-3 text-xs font-semibold text-slate-200 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300';

export function SectionPanel({ viewer, extras = false }: { viewer: ModelViewerState; extras?: boolean }) {
  const section = viewer.features?.section;
  const { snapshot } = viewer;
  if (!section) return null;
  const enabled = Boolean(snapshot.sectionEnabled);
  const recommended = snapshot.sectionRecommended;
  const current: PlaneId = snapshot.sectionOnRecommended ? 'recommended' : snapshot.sectionAxis ?? 'z';
  const cutPosition = snapshot.sectionPosition ?? 50;
  const planeName = current === 'recommended' ? 'R plane' : `${current.toUpperCase()} plane`;

  const choose = (plane: PlaneId) => {
    if (plane !== current) {
      if (plane === 'recommended') section.useRecommended();
      else { section.setAxis(plane); section.setPosition(50); }
    }
    // Picking a plane means the learner wants to see it cut.
    section.setEnabled(true);
  };

  const chip = (plane: PlaneId, letter: string) => {
    const selected = current === plane;
    return <button
      key={plane}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={plane === 'recommended' ? `R, the recommended plane: ${recommended}` : `${letter} plane`}
      onClick={() => choose(plane)}
      className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 ${selected ? 'bg-teal-400/20 text-teal-200 font-bold border-b-2 border-teal-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
    >
      {plane === 'recommended' ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <PlaneGlyph axis={plane} />}
      {letter}
    </button>;
  };

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-tight text-white">Cross section</div>
        <div className="mt-px text-xs text-slate-400">{planeName} · {cutPosition}%</div>
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Cross section" onClick={() => section.setEnabled(!enabled)} className="group flex h-11 shrink-0 items-center outline-none">
        <span className={`flex h-9 min-w-14 items-center justify-center rounded-xl px-3.5 text-xs font-bold transition-colors group-focus-visible:ring-2 group-focus-visible:ring-teal-300 ${enabled ? 'bg-teal-400 text-slate-950 shadow-sm' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>{enabled ? 'On' : 'Off'}</span>
      </button>
    </div>

    <div>
      <div role="radiogroup" aria-label="Section plane" className={`grid gap-1.5 ${recommended ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {recommended && chip('recommended', 'R')}
        {AXES.map((axis) => chip(axis, axis.toUpperCase()))}
      </div>
      {recommended && <p className="mx-0.5 mt-2 text-xs leading-snug text-slate-400">R is the plane recommended for this step: {recommended}.</p>}
    </div>

    <label className="block">
      <span className="flex items-baseline justify-between text-xs text-slate-300"><span>Plane position</span><span className="font-mono text-xs font-bold text-white">{cutPosition}%</span></span>
      <input type="range" min="0" max="100" value={cutPosition} onChange={(event) => section.setPosition(Number(event.target.value))} className="mt-1 block h-11 w-full accent-teal-400 cursor-pointer" />
    </label>

    {extras && <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
      <button type="button" onClick={() => section.flip()} className={secondary}>Reverse cut</button>
      <button type="button" onClick={() => section.reset()} className={secondary}>Reset</button>
    </div>}
  </div>;
}
