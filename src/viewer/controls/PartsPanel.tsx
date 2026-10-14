import React from 'react';
import { Search } from 'lucide-react';
import type { ModelComponent, ViewerFeatures, ViewerSnapshot } from '../types';

type PartsPanelProps = {
  definitionLabel: string;
  features: ViewerFeatures;
  snapshot: ViewerSnapshot;
  filteredComponents: ModelComponent[];
  query: string;
  onQueryChange: (value: string) => void;
  group: string;
  onGroupChange: (value: string) => void;
};

const field = 'min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 outline-none transition-colors focus:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-300';

/**
 * Pick a part, or a subassembly, to read about. What to do with it (show it alone, see through the rest) is the Spotlight tab's job,
 * so this tab only chooses; "Show all" puts everything back.
 */
export function PartsPanel({ definitionLabel, features, snapshot, filteredComponents, query, onQueryChange, group, onGroupChange }: PartsPanelProps) {
  const components = features.components;
  if (!components) return null;
  return <div className="space-y-2.5">
    {features.powerPaths && <div className="space-y-2 rounded-xl border border-teal-500/20 bg-teal-500/10 p-3">
      <label className="block text-xs font-bold text-teal-200">Trace power path<select aria-label="Power path" value={snapshot.powerPathId || ''} onChange={event => features.powerPaths!.select(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs text-slate-200 outline-none focus:border-teal-400"><option value="">Choose an accessory</option>{features.powerPaths.items.map(path => <option key={path.id} value={path.id}>{path.label}</option>)}</select></label>
      <p className="text-xs leading-relaxed text-teal-100">{snapshot.powerPathNote || 'Select an accessory to highlight its mechanical path and show output rotation arrows. All geometry dimensions are illustrative.'}</p>
      <button disabled={!snapshot.powerPathId} onClick={() => features.powerPaths!.isolate()} className="min-h-11 w-full rounded-xl bg-teal-400 p-2 text-xs font-bold text-slate-950 transition-colors hover:bg-teal-300 disabled:opacity-40">Isolate complete drive path</button>
    </div>}
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Search components" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search components…" className={`${field} pl-9`} /></div>
    <select aria-label="Subassembly" value={group} onChange={(event) => onGroupChange(event.target.value)} className={field}>{components.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    <select aria-label="Component" value={snapshot.selectedId || ''} onChange={(event) => components.select(event.target.value)} className={field}><option value="">Choose a component (optional)</option>{filteredComponents.map((component) => <option key={component.id} value={component.id}>{component.label}</option>)}</select>
    <div className="border-y border-white/10 py-2.5 px-0.5"><strong className="text-xs font-bold text-white block">{snapshot.selectedLabel || definitionLabel}</strong><p className="mt-1 text-xs leading-relaxed text-slate-400">{snapshot.selectedDescription || `${filteredComponents.length} teaching components available.`}</p></div>
    <button type="button" onClick={() => components.showAll()} className="min-h-11 w-full rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300">Show all</button>
  </div>;
}
