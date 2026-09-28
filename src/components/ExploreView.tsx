import React from 'react';
import { Box, ChevronLeft, ChevronRight, ExternalLink, Gauge, Layers3, Maximize2, Minimize2, Move3D } from 'lucide-react';
import { VisualIllustration } from './VisualIllustrations';

interface ExploreViewProps {
  activeModelName: string;
  isViewerOpen: boolean;
  onSelectModel: (model: string) => void;
  onBackToMenu: () => void;
  isFullscreen3D: boolean;
  onToggleFullscreen: () => void;
  onExitFullscreen: () => void;
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
];

const modelIds = Object.fromEntries(models.map((model) => [model.name, model.id]));

export const ExploreView: React.FC<ExploreViewProps> = ({
  activeModelName,
  isViewerOpen,
  onSelectModel,
  onBackToMenu,
  isFullscreen3D,
  onToggleFullscreen,
}) => {
  if (!isViewerOpen) {
    return <div className="h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-6 pt-5 sm:px-6">
        <div><span className="font-mono text-[11px] font-bold tracking-[0.24em] text-teal-400">EXPLORE MODE</span><h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Choose a 3D study</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Select an assembly to inspect its published model, component evidence and available operating controls.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((model) => <button key={model.id} onClick={() => onSelectModel(model.name)} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#09191f] text-left shadow-xl transition hover:border-teal-400/50 hover:-translate-y-0.5">
            <div className="relative h-40 overflow-hidden border-b border-white/5 bg-slate-950"><VisualIllustration type={model.imageType} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" /><div className="absolute inset-0 bg-gradient-to-t from-[#07151a] via-transparent to-transparent" /><span className="absolute bottom-3 left-3 rounded-md border border-teal-400/30 bg-[#061418]/90 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-teal-300">{model.eyebrow}</span></div>
            <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-white group-hover:text-teal-300">{model.name}</h2><p className="mt-1 text-xs leading-relaxed text-slate-300">{model.description}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 group-hover:border-teal-400 group-hover:text-teal-300"><ChevronRight className="h-4 w-4" /></span></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{model.badges.map((badge, index) => <span key={badge} className="inline-flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 font-mono text-[10px] text-slate-300">{index === 0 ? <Box className="h-3 w-3 text-teal-400" /> : index === 1 ? <Move3D className="h-3 w-3 text-teal-400" /> : <Layers3 className="h-3 w-3 text-teal-400" />}{badge}</span>)}</div>
            </div>
          </button>)}
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-950/15 p-4 text-xs leading-relaxed text-slate-300"><Gauge className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" /><p><strong className="text-slate-100">Real production models.</strong> These studies use the published GLB assets, component catalogue and validated motion contracts—not the procedural geometry from the visual prototype.</p></div>
      </div>
    </div>;
  }

  const modelId = modelIds[activeModelName] || 'cylinder';
  const viewerUrl = `./explore.html?model=${encodeURIComponent(modelId)}&embed=1`;
  return <div className="relative h-full min-h-0 w-full bg-[#061014]">
    <iframe key={modelId} src={viewerUrl} title={`${activeModelName} interactive 3D explorer`} className="h-full w-full border-0 bg-[#061014]" allow="fullscreen" />
    <div className="absolute left-3 top-3 z-20"><button onClick={onBackToMenu} className="flex h-10 items-center gap-1.5 rounded-full border border-slate-600/70 bg-[#07161b]/90 px-3 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300"><ChevronLeft className="h-4 w-4" />Models</button></div>
    <div className="absolute right-3 top-3 z-20 flex gap-2"><a href={`./explore.html?model=${encodeURIComponent(modelId)}`} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title="Open the standalone explorer" aria-label="Open the standalone explorer"><ExternalLink className="h-4 w-4" /></a><button onClick={onToggleFullscreen} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'} aria-label={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'}>{isFullscreen3D ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button></div>
  </div>;
};
