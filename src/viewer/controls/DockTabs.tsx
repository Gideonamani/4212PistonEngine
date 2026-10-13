import React, { useRef } from 'react';
import type { ModelViewerState } from '../useModelViewer';
import { PANELS, type PanelDefinition, type PanelId } from './panels';

type DockTabsProps = {
  viewer: ModelViewerState;
  panels: PanelDefinition[];
  /** The open panel, or null while they are all closed. */
  open: PanelId | null;
  onSelect: (id: PanelId) => void;
  /** Icon and name only, in a row of small tabs: the Explore side panel, and any row of more than three. Otherwise each tab also shows its live value. */
  compact?: boolean;
};

const VALUE_TONE = { amber: 'text-amber-300', teal: 'text-teal-300', muted: 'text-slate-400' } as const;

export const panelDomId = (id: PanelId, part: 'tab' | 'panel') => `viewer-${part}-${id}`;

/** The tab row of the controls: one tab per available panel, the open one marked. */
export function DockTabs({ viewer, panels, open, onSelect, compact = false }: DockTabsProps) {
  const dense = compact || panels.length > 3;
  const listRef = useRef<HTMLDivElement>(null);
  // Arrow keys move between the tabs, as in any tab row; Enter or Space opens the one in focus.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const index = tabs.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next].focus();
  };
  return <div ref={listRef} role="tablist" aria-label="Model controls" onKeyDown={onKeyDown} style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }} className="grid gap-1 rounded-[1.25rem] border border-white/10 bg-slate-900/70 p-1">
    {panels.map(({ id, label, Icon }, index) => {
      const selected = open === id;
      const value = PANELS[id].value?.(viewer);
      return <button
        key={id}
        type="button"
        role="tab"
        id={panelDomId(id, 'tab')}
        aria-selected={selected}
        aria-controls={selected ? panelDomId(id, 'panel') : undefined}
        // The label is hidden on the narrowest screens, and the value may be hidden in a small tab, so the tab says both itself.
        aria-label={value ? `${label}, ${value.text}` : label}
        tabIndex={selected || (open === null && index === 0) ? 0 : -1}
        onClick={() => onSelect(id)}
        className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${dense ? 'min-h-11' : 'min-h-[3.6rem]'} ${selected ? 'border-teal-400/50 bg-teal-400/10 text-white' : 'border-transparent text-slate-300 hover:bg-white/5'}`}
      >
        <span className={`flex items-center gap-1.5 font-semibold ${dense ? 'text-[11px]' : 'text-[13px]'} ${selected ? 'font-bold' : ''}`}>
          <Icon className={`${dense ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${selected ? 'text-teal-300' : 'text-slate-400'}`} aria-hidden="true" />
          <span className={dense ? 'hidden min-[380px]:inline lg:inline' : ''}>{label}</span>
        </span>
        {!dense && value && <span className={`font-mono text-[11px] font-bold ${VALUE_TONE[value.tone]}`}>{value.text}</span>}
      </button>;
    })}
  </div>;
}
