import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Box, ChevronRight, Gauge, Layers3, Move3D } from 'lucide-react';
import { VisualIllustration } from './VisualIllustrations';
import { modelRegistry, modelsByLabel } from '../data/modelRegistry';

const ModelViewer = React.lazy(() => import('../viewer/ModelViewer'));

interface ExploreViewProps {
  activeModelName: string;
  isViewerOpen: boolean;
  onSelectModel: (model: string) => void;
  isFullPage: boolean;
  onToggleFullPage: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  activeModelName,
  isViewerOpen,
  onSelectModel,
  isFullPage,
  onToggleFullPage,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => setIsBrowserFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleBrowserFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (viewerRef.current && document.fullscreenEnabled) {
      await viewerRef.current.requestFullscreen();
    }
  };

  if (!isViewerOpen) {
    return <div className="h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-5 pt-4 sm:px-6">
        <div><span className="font-mono text-[11px] font-bold tracking-[0.24em] text-teal-400">EXPLORE MODE</span><h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Choose a 3D study</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Select an assembly to inspect its published model, component evidence and available operating controls.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {modelRegistry.map((model) => <button key={model.id} onClick={() => onSelectModel(model.label)} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#09191f] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-teal-400/50">
            <div className="relative h-28 overflow-hidden border-b border-white/5 bg-slate-950 sm:h-32"><>{model.previewUrl ? <img src={model.previewUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <VisualIllustration type={model.imageType} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" />}</><div className="absolute inset-0 bg-gradient-to-t from-[#07151a] via-transparent to-transparent" /><span className="absolute bottom-2.5 left-3 rounded-md border border-teal-400/30 bg-[#061418]/90 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-teal-300">{model.eyebrow}</span></div>
            <div className="p-3"><h2 className="text-base font-bold text-white group-hover:text-teal-300 sm:text-lg">{model.label}</h2><p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-300 sm:text-xs">{model.description}</p>
              <div className="mt-2.5 flex min-w-0 items-center gap-1.5 max-[370px]:flex-wrap">{model.badges.map((badge, index) => <span key={badge} title={badge} className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-700/70 bg-slate-900/70 px-1.5 py-1 font-mono text-[9px] text-slate-300 sm:px-2 sm:text-[10px]">{index === 0 ? <Box className="h-3 w-3 shrink-0 text-teal-400" /> : index === 1 ? <Move3D className="h-3 w-3 shrink-0 text-teal-400" /> : <Layers3 className="h-3 w-3 shrink-0 text-teal-400" />}<span className="truncate">{badge}</span></span>)}<span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 group-hover:border-teal-400 group-hover:text-teal-300"><ChevronRight className="h-3.5 w-3.5" /></span></div>
            </div>
          </button>)}
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-950/15 p-4 text-xs leading-relaxed text-slate-300"><Gauge className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" /><p><strong className="text-slate-100">Real production models.</strong> These studies use published CAD exports and saved motions. Read each study’s scope: manual relationships and checked geometry may include illustrative dimensions and operating travel.</p></div>
      </div>
    </div>;
  }

  const modelId = modelsByLabel[activeModelName]?.id || 'cylinder';
  return <div ref={viewerRef} className="absolute inset-0 min-h-0 overflow-hidden bg-[#061014]">
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-teal-300">Preparing interactive 3D viewer…</div>}>
      <ModelViewer
        modelId={modelId}
        profile="explore"
        immersive
        isFullPage={isFullPage}
        isFullscreen={isBrowserFullscreen}
        onToggleFullPage={onToggleFullPage}
        onToggleFullscreen={toggleBrowserFullscreen}
      />
    </Suspense>
  </div>;
};
