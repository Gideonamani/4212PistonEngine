import React from 'react';
import { Box } from 'lucide-react';
import { modelsById } from '../data/modelRegistry';
import { lessonProfile } from './core/view-state.mjs';
import { HotspotChips, HotspotNote, ModelCanvas, UnknownModel, ViewerHeader } from './ViewerParts';
import { useModelViewer } from './useModelViewer';
import type { ViewUpdate } from './types';

type LessonViewerProps = {
  modelId: string;
  view: ViewUpdate;
  immersive?: boolean;
  onOpenExplore?: () => void;
};

/** The compact viewer inside a lesson step: the step's pose and spotlight, its hotspots, and a way into full Explore. */
export default function LessonViewer({ modelId, view, immersive = false, onOpenExplore }: LessonViewerProps) {
  const definition = modelsById[modelId];
  const viewer = useModelViewer(modelId, lessonProfile(definition?.adapter), view);
  const { features, snapshot } = viewer;
  if (!definition) return <UnknownModel modelId={modelId} />;

  const height = immersive ? 'h-[58dvh] min-h-[22rem]' : 'h-[20rem] min-h-[18rem] sm:h-[24rem]';
  return <section className={`relative isolate flex overflow-hidden rounded-xl border border-teal-400/20 bg-[#071418] text-slate-100 shadow-inner ${height}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <ModelCanvas viewer={viewer} />
      <ViewerHeader viewer={viewer} />

      {snapshot.assemblyNotice && <p className="pointer-events-none absolute inset-x-3 top-20 z-10 max-w-sm rounded-lg bg-[#07161b]/90 px-3 py-2 text-xs leading-relaxed text-amber-100">{snapshot.assemblyNotice}</p>}

      {viewer.session && <div className="absolute inset-x-2 bottom-2 z-10 rounded-xl border border-slate-700/80 bg-[#07161b]/95 p-2 shadow-xl backdrop-blur-sm sm:inset-x-3 sm:bottom-3">
        <HotspotChips viewer={viewer} className="pb-1" />
        {features?.motion && <div className="flex items-center gap-3"><span className="rounded-lg border border-teal-500/30 bg-teal-950/40 px-2.5 py-1.5 font-mono text-[10px] font-bold text-teal-300">POSE {Math.round(snapshot.angle ?? 0)}°</span><p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-slate-400">{snapshot.motionNote}</p></div>}
        <HotspotNote viewer={viewer} className="px-1 pt-1" />
        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-800/80 px-1 pt-1.5">
          <span className="truncate text-[9px] text-slate-500">{definition.sourceLabel ? `${definition.sourceLabel} · ${definition.license}` : definition.label}</span>
          {onOpenExplore && <button type="button" onClick={onOpenExplore} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950"><Box className="h-3 w-3" />Explore fully</button>}
        </div>
      </div>}
    </div>
  </section>;
}
