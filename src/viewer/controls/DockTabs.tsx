import React, { useRef } from 'react';
import type { ModelViewerState } from '../useModelViewer';
import { PANELS, type PanelContext, type PanelDefinition, type PanelId } from './panels';

type DockTabsProps = {
  viewer: ModelViewerState;
  panels: PanelDefinition[];
  context: PanelContext;
  /** The open panel, or null while they are all closed. */
  open: PanelId | null;
  onSelect: (id: PanelId) => void;
  /** Icon over name, in a row of small tabs: the Explore side panel, and any row of more than three. Otherwise each tab also shows its live value. */
  compact?: boolean;
};

const VALUE_TONE = { amber: 'text-amber-300', teal: 'text-teal-300', muted: 'text-slate-400' } as const;

export const panelDomId = (id: PanelId, part: 'tab' | 'panel') => `viewer-${part}-${id}`;

/** The tab row of the controls: one tab per available panel, the open one marked. */
export function DockTabs({ viewer, panels, context, open, onSelect, compact = false }: DockTabsProps) {
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
  return <div ref={listRef} role="tablist" aria-label="Model controls" onKeyDown={onKeyDown} style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }} className="grid border-b border-white/10 bg-transparent">
    {panels.map(({ id, label, Icon }, index) => {
      const selected = open === id;
      const value = PANELS[id].value?.(viewer, context);
      return <button
        key={id}
        type="button"
        role="tab"
        id={panelDomId(id, 'tab')}
        aria-selected={selected}
        aria-controls={selected ? panelDomId(id, 'panel') : undefined}
        // A small tab leaves out the value, so the tab says both itself.
        aria-label={value ? `${label}, ${value.text}` : label}
        tabIndex={selected || (open === null && index === 0) ? 0 : -1}
        onClick={() => onSelect(id)}
        className={`group relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 ${dense ? 'min-h-11' : 'min-h-12'} ${selected ? 'text-teal-300 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'}`}
      >
        <span className={`flex items-center ${dense ? 'flex-col gap-0.5 text-xs' : 'gap-1.5 text-[13px]'} ${selected ? 'font-bold' : 'font-semibold'}`}>
          <Icon className={`h-4 w-4 shrink-0 transition-colors ${selected ? 'text-teal-300' : 'text-slate-400 group-hover:text-slate-300'}`} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
        {!dense && value && <span className={`font-mono text-[11px] font-semibold ${VALUE_TONE[value.tone]}`}>{value.text}</span>}
        {selected && <span className="absolute bottom-0 inset-x-2 h-0.5 bg-teal-400 rounded-full" aria-hidden="true" />}
      </button>;
    })}
  </div>;
}
