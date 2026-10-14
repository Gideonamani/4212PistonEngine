import React, { useState } from 'react';
import { Box, Check, ChevronDown, ChevronRight, Ghost, Highlighter, Minus, Search, X } from 'lucide-react';
import { inComponentGroup } from '../core/component-groups.mjs';
import type { FocusMode, ModelComponent, ViewerFeatures, ViewerSnapshot } from '../types';

type PartsPanelProps = {
  definitionLabel: string;
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
  filteredComponents: ModelComponent[];
  query: string;
  onQueryChange: (value: string) => void;
  group: string;
  onGroupChange: (value: string) => void;
  selectedIds?: string[];
  onTogglePart?: (id: string) => void;
  onSelectSinglePart?: (id: string) => void;
  onToggleGroup?: (groupId: string) => void;
  onClearSelected?: () => void;
  currentFocusMode?: FocusMode;
  onChooseFocusMode?: (mode: FocusMode) => void;
};

const field = 'min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 outline-none transition-colors focus:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-300';

const STYLE_ICONS: Record<FocusMode, React.ComponentType<{ className?: string }>> = {
  highlight: Highlighter,
  xray: Ghost,
  isolate: Box,
};

const STYLE_LABELS: Record<FocusMode, string> = {
  highlight: 'Highlight',
  xray: 'X-ray',
  isolate: 'Isolate',
};

const GROUP_COLORS: Record<string, string> = {
  structure: '#2dd4bf', // Teal
  piston: '#f59e0b',    // Amber
  crank: '#fb923c',     // Orange
  intake: '#38bdf8',    // Sky
  exhaust: '#a78bfa',   // Violet
  ignition: '#f472b6',  // Pink
  crankcase: '#f59e0b', // Amber
  cylinders: '#38bdf8', // Sky
  induction: '#34d399', // Emerald
  lubrication: '#a78bfa', // Violet
};

const PALETTE = ['#f59e0b', '#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#2dd4bf'];

function getGroupColor(groupId: string, index: number): string {
  if (GROUP_COLORS[groupId]) return GROUP_COLORS[groupId];
  return PALETTE[index % PALETTE.length];
}

/**
 * Explore's Parts tab: browse and multi-select components or entire subassemblies to spotlight (highlight, x-ray, isolate).
 * A selected parts tray and style switcher allow instant focus changes; "Show all" restores the entire engine.
 */
export function PartsPanel({
  definitionLabel,
  features,
  snapshot,
  filteredComponents,
  query,
  onQueryChange,
  group,
  onGroupChange,
  selectedIds = [],
  onTogglePart,
  onSelectSinglePart,
  onToggleGroup,
  onClearSelected,
  currentFocusMode,
  onChooseFocusMode,
}: PartsPanelProps) {
  const components = features.components;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  if (!components) return null;

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const selectedCount = selectedIds.length;
  // Exclude empty id ('All groups') so subassemblies aren't duplicated under an 'ALL GROUPS' header
  const allGroups = components.groups.filter((g) => Boolean(g.id) && g.id !== 'all');
  const groupsToDisplay = allGroups.length > 0 ? allGroups : [{ id: 'all', label: 'All components' }];

  const handleClear = () => {
    if (onClearSelected) onClearSelected();
    else components.showAll();
  };

  return <div className="space-y-3">
    {features.powerPaths && <div className="space-y-2 rounded-xl border border-teal-500/20 bg-teal-500/10 p-3">
      <label className="block text-xs font-bold text-teal-200">
        Trace power path
        <select
          aria-label="Power path"
          value={snapshot.powerPathId || ''}
          onChange={(event) => features.powerPaths!.select(event.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs text-slate-200 outline-none focus:border-teal-400"
        >
          <option value="">Choose an accessory</option>
          {features.powerPaths.items.map((path) => <option key={path.id} value={path.id}>{path.label}</option>)}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-teal-100">
        {snapshot.powerPathNote || 'Select an accessory to highlight its mechanical path and show output rotation arrows. All geometry dimensions are illustrative.'}
      </p>
      <button
        disabled={!snapshot.powerPathId}
        onClick={() => features.powerPaths!.isolate()}
        className="min-h-11 w-full rounded-xl bg-teal-400 p-2 text-xs font-bold text-slate-950 transition-colors hover:bg-teal-300 disabled:opacity-40"
      >
        Isolate complete drive path
      </button>
    </div>}

    {/* Search components */}
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
      <input
        aria-label="Search components"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search components…"
        className={`${field} pl-9`}
      />
    </div>

    {/* Quick-select dropdowns for single-part jump & accessibility */}
    <div className="grid grid-cols-2 gap-2">
      <select
        aria-label="Subassembly"
        value={group}
        onChange={(event) => onGroupChange(event.target.value)}
        className={`${field} text-[11px]`}
      >
        <option value="">All subassemblies</option>
        {components.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>

      <select
        aria-label="Component"
        value={selectedIds.length === 1 ? selectedIds[0] : snapshot.selectedId || ''}
        onChange={(event) => {
          const id = event.target.value;
          if (onSelectSinglePart) onSelectSinglePart(id);
          else {
            components.select(id);
            if (id && onTogglePart && !selectedIds.includes(id)) onTogglePart(id);
          }
        }}
        className={`${field} text-[11px]`}
      >
        <option value="">Quick pick part…</option>
        {filteredComponents.map((component) => <option key={component.id} value={component.id}>{component.label}</option>)}
      </select>
    </div>

    {/* Selected components tray and style controls */}
    {selectedCount > 0 && <div className="rounded-xl border border-teal-400/30 bg-teal-400/10 p-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-teal-200">
          {selectedCount} {selectedCount === 1 ? 'part' : 'parts'} selected
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-teal-300 hover:bg-teal-400/20"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {selectedIds.map((id) => {
          const item = components.items.find((c) => c.id === id);
          const label = item?.label || id;
          return <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-teal-400/40 bg-teal-400/20 py-0.5 pl-2 pr-1 text-[11px] font-semibold text-teal-100"
          >
            <span className="truncate max-w-[140px]">{label}</span>
            {onTogglePart && <button
              type="button"
              onClick={() => onTogglePart(id)}
              aria-label={`Remove ${label}`}
              className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-900/60"
            >
              <X className="h-3 w-3" />
            </button>}
          </span>;
        })}
      </div>

      {onChooseFocusMode && <div className="pt-1.5 border-t border-teal-400/20">
        <div className="grid grid-cols-3 gap-1">
          {(['highlight', 'xray', 'isolate'] as FocusMode[]).map((mode) => {
            const Icon = STYLE_ICONS[mode];
            const active = currentFocusMode === mode;
            return <button
              key={mode}
              type="button"
              onClick={() => onChooseFocusMode(mode)}
              className={`flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold outline-none transition-colors ${active ? 'bg-teal-400 text-slate-950 font-bold' : 'bg-slate-950/60 text-slate-300 hover:bg-white/10'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {STYLE_LABELS[mode]}
            </button>;
          })}
        </div>
      </div>}
    </div>}

    {/* Multi-select Checklist grouped by subassembly */}
    <div className="space-y-3 max-h-80 overflow-y-auto pr-0.5">
      {groupsToDisplay.map((grp, grpIdx) => {
        const groupComponents = components.items.filter((c) => inComponentGroup(c, grp.id));
        const vis = groupComponents.filter((c) => filteredComponents.some((fc) => fc.id === c.id));
        if (vis.length === 0) return null;

        const isCollapsed = collapsedGroups[grp.id] ?? false;
        const groupSelectedCount = groupComponents.filter((c) => selectedIds.includes(c.id)).length;
        const allSelected = groupSelectedCount === groupComponents.length && groupComponents.length > 0;
        const someSelected = groupSelectedCount > 0 && !allSelected;
        const groupColor = getGroupColor(grp.id, grpIdx);

        return (
          <div key={grp.id} className="space-y-1.5">
            {/* Subassembly header */}
            <div className="flex items-center gap-2 px-1 py-1">
              {onToggleGroup && (
                <button
                  type="button"
                  onClick={() => onToggleGroup(grp.id)}
                  aria-label={`Select all ${grp.label}`}
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    allSelected
                      ? 'border-teal-400 bg-teal-400 text-slate-950'
                      : someSelected
                      ? 'border-teal-400 bg-teal-400/25 text-teal-300'
                      : 'border-slate-600 bg-slate-900/60 hover:border-slate-500'
                  }`}
                >
                  {allSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  {someSelected && <Minus className="h-3.5 w-3.5 stroke-[3]" />}
                </button>
              )}

              <span
                className="h-2 w-2 rounded-sm shrink-0"
                style={{ backgroundColor: groupColor }}
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={() => toggleGroupCollapse(grp.id)}
                className="flex flex-1 items-center justify-between text-left outline-none min-w-0"
              >
                <span className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  {grp.label}
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-slate-400 shrink-0">
                  <span>{groupSelectedCount}/{groupComponents.length}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </div>
              </button>
            </div>

            {/* Component item cards matching mockup */}
            {!isCollapsed && (
              <div className="space-y-1">
                {vis.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTogglePart?.(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-all duration-150 outline-none ${
                        isSelected
                          ? 'border-teal-400/40 bg-teal-400/15 text-white ring-1 ring-teal-400/30'
                          : 'border-white/5 bg-slate-950/40 text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <div
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                          isSelected
                            ? 'border-teal-400 bg-teal-400 text-slate-950'
                            : 'border-slate-600 bg-slate-900/60'
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <span
                        className="h-2 w-2 rounded-sm shrink-0"
                        style={{ backgroundColor: groupColor }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Information banner when a single part is inspected */}
    {selectedIds.length <= 1 && (snapshot.selectedLabel || snapshot.selectedDescription) && (
      <div className="border-y border-white/10 py-2.5 px-0.5">
        <strong className="text-xs font-bold text-white block">{snapshot.selectedLabel || definitionLabel}</strong>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {snapshot.selectedDescription || `${filteredComponents.length} teaching components available.`}
        </p>
      </div>
    )}

    {/* Show all / Reset button */}
    <button
      type="button"
      onClick={handleClear}
      className="min-h-11 w-full rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300"
    >
      Show all
    </button>
  </div>;
}
