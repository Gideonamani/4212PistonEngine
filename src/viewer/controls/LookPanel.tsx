import React from 'react';
import type { AppearanceMode, ViewerFeatures, ViewerSnapshot } from '../types';

/** How the model is coloured: the inspection colours of the study, or the colours of the original CAD. */
export function LookPanel({ features, snapshot }: { features: ViewerFeatures; snapshot: ViewerSnapshot }) {
  const appearance = features.appearance;
  if (!appearance) return null;
  return <div className="space-y-2">
    <label htmlFor="viewer-colour-treatment" className="block text-[11px] font-bold text-slate-400">COLOUR TREATMENT</label>
    <select id="viewer-colour-treatment" value={snapshot.appearance || 'inspection'} onChange={(event) => appearance.setMode(event.target.value as AppearanceMode)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-xs"><option value="inspection">Inspection colours</option><option value="cad">Original CAD colours</option></select>
  </div>;
}
