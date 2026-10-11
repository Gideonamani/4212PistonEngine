import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Scissors, Sparkles } from 'lucide-react';
import type { SectionAxis } from './types';
import type { ModelViewerState } from './useModelViewer';

/**
 * The cross-section controls of a lesson's spotlight bar: a checkbox that cuts the model open, and a picker for where it is cut.
 * The picker offers the three standard planes and, when the step names one, a plane chosen for seeing that step's component best
 * (the step's `sectionPlane`). A slider at the foot of the picker slides the cut across the model.
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
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
    <polygon points="16,4.5 26.4,10.5 26.4,22.5 16,28.5 5.6,22.5 5.6,10.5" fill="none" stroke="#8399a0" strokeWidth="1.2" strokeLinejoin="round" />
    <polygon points={PLANE_POLYGON[axis]} fill="rgba(45,212,191,.38)" stroke="#5eead4" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const MENU_WIDTH = 300;
const MENU_HEIGHT = 372;
const GAP = 8;

type MenuPosition = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

/** Opens on whichever side of the button has the most room, and stays inside the screen. */
function placeMenu(trigger: HTMLElement): MenuPosition {
  const box = trigger.getBoundingClientRect();
  const width = Math.min(MENU_WIDTH, window.innerWidth - 2 * GAP);
  const left = Math.max(GAP, Math.min(box.left, window.innerWidth - width - GAP));
  const below = window.innerHeight - box.bottom - 2 * GAP;
  const above = box.top - 2 * GAP;
  if (below >= MENU_HEIGHT || below >= above) return { left, width, top: box.bottom + GAP, maxHeight: Math.max(160, below) };
  return { left, width, bottom: window.innerHeight - box.top + GAP, maxHeight: Math.max(160, above) };
}

export function SectionControls({ viewer }: { viewer: ModelViewerState }) {
  const section = viewer.features?.section;
  const { snapshot } = viewer;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recommended = snapshot.sectionRecommended;

  // The learner's viewer (and its step) can change under an open menu; a closed menu has nothing to keep in step.
  useEffect(() => { if (!section) setOpen(false); }, [section]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(placeMenu(triggerRef.current));
    const reposition = () => triggerRef.current && setPosition(placeMenu(triggerRef.current));
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  }, [open]);

  // On open, focus the plane in force, so the menu starts where the learner is.
  useEffect(() => {
    if (!open || !position) return;
    const chosen = menuRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    (chosen ?? menuRef.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [open, position === undefined]);

  if (!section) return null;
  const enabled = Boolean(snapshot.sectionEnabled);
  const current: PlaneId = snapshot.sectionOnRecommended ? 'recommended' : snapshot.sectionAxis ?? 'z';
  const label = current === 'recommended' ? recommended ?? 'Recommended' : `${current.toUpperCase()} plane`;
  const cutPosition = snapshot.sectionPosition ?? 50;

  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const choose = (plane: PlaneId) => {
    if (plane === 'recommended') section.useRecommended();
    else { section.setAxis(plane); section.setPosition(50); }
    // Picking a plane means the learner wants to see it cut.
    section.setEnabled(true);
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close(); return; }
    const focusable = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"], input') ?? []);
    if (event.key === 'Tab') {
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const options = focusable.filter((element) => element.getAttribute('role') === 'option');
    const index = options.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); options[(index + 1) % options.length].focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); options[(index - 1 + options.length) % options.length].focus(); }
    else if (event.key === 'Home') { event.preventDefault(); options[0].focus(); }
    else if (event.key === 'End') { event.preventDefault(); options[options.length - 1].focus(); }
  };

  const option = (id: PlaneId, name: string, hint?: string) => {
    const selected = current === id;
    return (
      <button
        key={id}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => choose(id)}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${selected ? 'border-teal-300/45 bg-teal-400/15' : 'border-transparent hover:bg-white/5'}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${id === 'recommended' ? 'bg-teal-400/15 text-teal-300' : 'bg-white/5'}`} aria-hidden="true">
          {id === 'recommended' ? <Sparkles className="h-5 w-5" /> : <PlaneGlyph axis={id} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">{name}</span>
          {hint && <span className="block text-xs font-medium text-slate-400">{hint}</span>}
        </span>
        {selected && <Check className="h-4 w-4 shrink-0 stroke-[2.6] text-teal-300" aria-hidden="true" />}
      </button>
    );
  };

  return <>
    <div role="group" aria-label="Cross section controls" className="inline-flex shrink-0 items-center rounded-xl border border-slate-700 bg-slate-900/70 p-0.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={enabled}
        aria-label="Cross section"
        onClick={() => section.setEnabled(!enabled)}
        className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.65rem] outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors ${enabled ? 'border-teal-400 bg-teal-400 text-slate-950' : 'border-slate-400 text-transparent group-hover:border-teal-300'}`}>
          <Check className="h-3.5 w-3.5 stroke-[3.2]" aria-hidden="true" />
        </span>
      </button>
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-slate-700" />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Section plane: ${label}`}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[0.65rem] pl-2.5 pr-2 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        {current === 'recommended' ? <Sparkles className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" /> : <Scissors className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />}
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      </button>
    </div>

    {open && position && createPortal(
      <div className="fixed inset-0 z-[120]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Section plane"
          onKeyDown={onMenuKeyDown}
          style={position}
          className="absolute overflow-y-auto rounded-[1.4rem] border border-white/15 bg-[#09161c]/97 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-slate-400">SECTION PLANE</p>
          <div role="listbox" aria-label="Section plane">
            {recommended && option('recommended', recommended, 'Recommended for this step')}
            {AXES.map((axis) => option(axis, `${axis.toUpperCase()} plane`))}
          </div>
          <div className="mx-2.5 mb-1 mt-1.5 border-t border-white/10 pt-2.5">
            <label className="block">
              <span className="flex items-center justify-between text-xs text-slate-300"><span>Plane position</span><span className="font-mono font-bold text-white">{cutPosition}%</span></span>
              <input
                type="range"
                min="0"
                max="100"
                value={cutPosition}
                onChange={(event) => section.setPosition(Number(event.target.value))}
                className="mt-1 block h-11 w-full accent-teal-400"
              />
            </label>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </>;
}
