import React from 'react';
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface ExploreViewProps {
  activeModelName: string;
  onSelectModel: (model: string) => void;
  isFullscreen3D: boolean;
  onToggleFullscreen: () => void;
  onExitFullscreen: () => void;
}

const modelIds: Record<string, string> = {
  'Detailed operating cylinder': 'cylinder',
  'Full six-cylinder engine': 'gtsio520-h-v5-teaching-engine',
};

export const ExploreView: React.FC<ExploreViewProps> = ({ activeModelName, isFullscreen3D, onToggleFullscreen }) => {
  const modelId = modelIds[activeModelName] || 'cylinder';
  const viewerUrl = `./explore.html?model=${encodeURIComponent(modelId)}&embed=1`;

  return <div className="relative h-full min-h-0 w-full bg-[#061014]">
    <iframe
      key={modelId}
      src={viewerUrl}
      title={`${activeModelName} interactive 3D explorer`}
      className="h-full w-full border-0 bg-[#061014]"
      allow="fullscreen"
    />
    <div className="absolute right-3 top-3 z-20 flex gap-2">
      <a href={`./explore.html?model=${encodeURIComponent(modelId)}`} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title="Open the standalone explorer" aria-label="Open the standalone explorer"><ExternalLink className="h-4 w-4" /></a>
      <button onClick={onToggleFullscreen} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg backdrop-blur hover:border-teal-400 hover:text-teal-300" title={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'} aria-label={isFullscreen3D ? 'Exit immersive view' : 'Open immersive view'}>{isFullscreen3D ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
    </div>
  </div>;
};
