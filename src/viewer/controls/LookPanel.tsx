import React from 'react';
import type { AppearanceMode, ViewerFeatures, ViewerSnapshot } from '../types';
import { useCentreOnSelect } from '../explorePreferences';
import type { PanelHost } from './panels';

/**
 * How the model is shown: the inspection colours of the study or the colours of the original CAD and, in Explore, whether selecting a
 * part brings it to the middle of the view or leaves the camera where the learner put it.
 */
export function LookPanel({ features, snapshot, host = 'lesson' }: { features: ViewerFeatures; snapshot: ViewerSnapshot; host?: PanelHost }) {
  const appearance = features.appearance;
  const [centre, setCentre] = useCentreOnSelect();
  const camera = host === 'explore' && Boolean(features.components);
  return <div className="space-y-4">
    {appearance && <div className="space-y-2">
      <label htmlFor="viewer-colour-treatment" className="block text-xs font-semibold tracking-wider text-slate-400">COLOUR TREATMENT</label>
      <select id="viewer-colour-treatment" value={snapshot.appearance || 'inspection'} onChange={(event) => appearance.setMode(event.target.value as AppearanceMode)} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 outline-none transition-colors focus:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-300"><option value="inspection">Inspection colours</option><option value="cad">Original CAD colours</option></select>
    </div>}
    {camera && <div className="space-y-2">
      <span className="block text-xs font-semibold tracking-wider text-slate-400">CAMERA</span>
      <button type="button" role="switch" aria-checked={centre} onClick={() => setCentre(!centre)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-teal-300">
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-slate-200">Centre the part I select</span>
          <span className="block text-[11px] leading-snug text-slate-400">{centre ? 'The view moves in on each part you select.' : 'The view stays where you left it.'}</span>
        </span>
        <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${centre ? 'bg-teal-400' : 'bg-slate-700'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-slate-950 shadow transition-transform ${centre ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
    </div>}
  </div>;
}
