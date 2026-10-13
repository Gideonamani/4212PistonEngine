import React, { Suspense, useEffect, useRef, useState } from 'react';
import { CardThumbnail } from './CardThumbnail';
import { CapabilityIcons, describeCapabilities } from './ModelCapabilities';
import { useShellChrome } from './ShellChrome';
import { modelRegistry, modelsByLabel } from '../data/modelRegistry';

const ExploreViewer = React.lazy(() => import('../viewer/ExploreViewer'));

interface ExploreViewProps {
  activeModelName: string;
  isViewerOpen: boolean;
  onSelectModel: (model: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  activeModelName,
  isViewerOpen,
  onSelectModel,
}) => {
  const { exploreFullPage: isFullPage, setExploreFullPage } = useShellChrome();
  const onToggleFullPage = () => setExploreFullPage((value) => !value);
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
    // Image first: a square render, a short name and what the model offers. Everything else a student needs to know about a model (what it is
    // and is not) waits in the viewer, so nothing here competes with the pictures.
    return <div className="h-full w-full overflow-y-auto bg-canvas pb-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-[70rem] flex-col px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">3D studies</h1>
        <p className="mb-5 mt-1.5 max-w-xl text-balance text-sm leading-relaxed text-slate-300 sm:mb-6 sm:text-[15px]">Select a model to explore it immersively in the 3D viewer.</p>
        {/* Two columns on a phone (a single one only below about 344 px), as many 232 px columns as fit on a larger screen. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] sm:gap-4">
          {modelRegistry.map((model) => <button key={model.id} type="button" onClick={() => onSelectModel(model.label)} aria-describedby={`capabilities-${model.id}`} className="group relative flex flex-col rounded-[1.125rem] border border-white/10 bg-inset text-left shadow-lg transition hover:-translate-y-0.5 hover:border-teal-400/50">
            <span className="relative block aspect-square overflow-hidden rounded-t-[1.0625rem] bg-inset"><CardThumbnail src={model.previewUrl} className="transition duration-300 group-hover:scale-[1.03]" /></span>
            <span className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
              <span className="min-h-9 text-sm font-semibold leading-[1.2] tracking-tight text-white group-hover:text-teal-300 sm:min-h-10 sm:text-[15px]">{model.shortLabel}</span>
              <CapabilityIcons capabilities={model.capabilities} />
            </span>
            {/* Hidden from the name (a tile is called by its title) but still read as its description: aria-describedby may point at hidden text. */}
            <span id={`capabilities-${model.id}`} hidden>{describeCapabilities(model.capabilities)}</span>
          </button>)}
        </div>
      </div>
    </div>;
  }

  const modelId = modelsByLabel[activeModelName]?.id || 'cylinder';
  return <div ref={viewerRef} className="absolute inset-0 min-h-0 overflow-hidden bg-canvas">
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-teal-300">Preparing interactive 3D viewer…</div>}>
      <ExploreViewer
        modelId={modelId}
        isFullPage={isFullPage}
        isFullscreen={isBrowserFullscreen}
        onToggleFullPage={onToggleFullPage}
        onToggleFullscreen={toggleBrowserFullscreen}
      />
    </Suspense>
  </div>;
};
