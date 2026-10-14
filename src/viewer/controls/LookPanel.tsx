import React from 'react';
import type { AppearanceMode, ViewerFeatures, ViewerSnapshot } from '../types';

/** How the model is coloured: the inspection colours of the study, or the colours of the original CAD. */
export function LookPanel({ features, snapshot }: { features: ViewerFeatures; snapshot: ViewerSnapshot }) {
  const appearance = features.appearance;
  if (!appearance) return null;
  return <div className="space-y-2">
    <label htmlFor="viewer-colour-treatment" className="block text-xs font-semibold tracking-wider text-slate-400">COLOUR TREATMENT</label>
    <select id="viewer-colour-treatment" value={snapshot.appearance || 'inspection'} onChange={(event) => appearance.setMode(event.target.value as AppearanceMode)} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 outline-none transition-colors focus:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-300"><option value="inspection">Inspection colours</option><option value="cad">Original CAD colours</option></select>
  </div>;
}
