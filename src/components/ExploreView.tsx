import React, { Suspense } from 'react';
import { Box, ChevronRight, ExternalLink, Gauge, Layers3, Maximize2, Minimize2, Move3D } from 'lucide-react';
import { VisualIllustration } from './VisualIllustrations';

const ReferenceModelViewer = React.lazy(() => import('./ReferenceModelViewer'));

interface ExploreViewProps {
  activeModelName: string;
  isViewerOpen: boolean;
  onSelectModel: (model: string) => void;
  isFullscreen3D: boolean;
  onToggleFullscreen: () => void;
}

const models = [
  {
    id: 'cylinder',
    name: 'Detailed operating cylinder',
    eyebrow: 'OPERATING-CYCLE STUDY',
    description: 'Inspect 60 catalogued components, operate the 720° mechanism, isolate parts and use a live section view.',
    imageType: 'piston' as const,
    badges: ['60 components', 'Animated mechanism', 'Section view'],
  },
  {
    id: 'gtsio520-h-v5-teaching-engine',
    name: 'Full six-cylinder engine',
    eyebrow: 'WHOLE-ENGINE STUDY',
    description: 'Explore the developing GTSIO-520-H teaching assembly, its six-cylinder installation and drivetrain structure.',
    imageType: 'systems' as const,
    badges: ['6 cylinders', 'Engine systems', 'Teaching assembly'],
  },
  {
    id: 'wright-1903-engine',
    name: '1903 Wright Flyer engine',
    eyebrow: 'HISTORICAL REFERENCE',
    description: 'Inspect the Smithsonian engine scan with six guided feature hotspots and its original museum source context.',
    imageType: 'wright' as const,
    badges: ['CC0 museum scan', '6 guided hotspots', 'Static reference'],
  },
];

const modelIds = Object.fromEntries(models.map((model) => [model.name, model.id]));

export const ExploreView: React.FC<ExploreViewProps> = ({
  activeModelName,
  isViewerOpen,
  onSelectModel,
  isFullscreen3D,
  onToggleFullscreen,
}) => {
  if (!isViewerOpen) {
    return <div className="h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-5 pt-4 sm:px-6">
        <div><span className="font-mono text-[11px] font-bold tracking-[0.24em] text-teal-400">EXPLORE MODE</span><h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Choose a 3D study</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Select an assembly to inspect its published model, component evidence and available operating controls.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((model) => <button key={model.id} onClick={() => onSelectModel(model.name)} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#09191f] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-teal-400/50">
            <div className="relative h-28 overflow-hidden border-b border-white/5 bg-slate-950 sm:h-32"><VisualIllustration type={model.imageType} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" /><div className="absolute inset-0 bg-gradient-to-t from-[#07151a] via-transparent to-transparent" /><span className="absolute bottom-2.5 left-3 rounded-md border border-teal-400/30 bg-[#061418]/90 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-teal-300">{model.eyebrow}</span></div>
            <div className="p-3"><h2 className="text-base font-bold text-white group-hover:text-teal-300 sm:text-lg">{model.name}</h2><p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-300 sm:text-xs">{model.description}</p>
              <div className="mt-2.5 flex min-w-0 items-center gap-1.5 max-[370px]:flex-wrap">{model.badges.map((badge, index) => <span key={badge} title={badge} className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-700/70 bg-slate-900/70 px-1.5 py-1 font-mono text-[9px] text-slate-300 sm:px-2 sm:text-[10px]">{index === 0 ? <Box className="h-3 w-3 shrink-0 text-teal-400" /> : index === 1 ? <Move3D className="h-3 w-3 shrink-0 text-teal-400" /> : <Layers3 className="h-3 w-3 shrink-0 text-teal-400" />}<span className="truncate">{badge}</span></span>)}<span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 group-hover:border-teal-400 group-hover:text-teal-300"><ChevronRight className="h-3.5 w-3.5" /></span></div>
            </div>
          </button>)}
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-950/15 p-4 text-xs leading-relaxed text-slate-300"><Gauge className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" /><p><strong className="text-slate-100">Real production models.</strong> These studies use the published GLB assets, component catalogue and validated motion contracts—not the procedural geometry from the visual prototype.</p></div>
      </div>
    </div>;
  }

  const modelId = modelIds[activeModelName] || 'cylinder';
  const viewerUrl = `./explore.html?model=${encodeURIComponent(modelId)}&embed=1`;
  if (modelId === 'wright-1903-engine') return <div className="absolute inset-0 min-h-0 overflow-hidden bg-[#061014] p-2 sm:p-3">
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-teal-300">Preparing historical 3D reference…</div>}>
      <ReferenceModelViewer modelId={modelId} mode="explore" immersive />
    </Suspense>
    <div className="absolute right-16 top-5 z-20 flex gap-2"><button onClick={onToggleFullscreen} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'} aria-label={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'}>{isFullscreen3D ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button></div>
  </div>;
  return <div className="absolute inset-0 min-h-0 overflow-hidden bg-[#061014]">
    <iframe key={modelId} src={viewerUrl} title={`${activeModelName} interactive 3D explorer`} className="absolute inset-0 h-full w-full border-0 bg-[#061014]" allow="fullscreen" />
    <div className="absolute right-3 top-3 z-20 flex gap-2"><a href={`./explore.html?model=${encodeURIComponent(modelId)}`} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title="Open the standalone explorer" aria-label="Open the standalone explorer"><ExternalLink className="h-4 w-4" /></a><button onClick={onToggleFullscreen} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'} aria-label={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'}>{isFullscreen3D ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button></div>
  </div>;
};
