import React, { useMemo, useState } from 'react';
import { Expand, Maximize2, Minimize2, Shrink, SlidersHorizontal } from 'lucide-react';
import { modelsById } from '../data/modelRegistry';
import { inComponentGroup } from './core/component-groups.mjs';
import { lessonProfile } from './core/view-state.mjs';
import { CompactMotionPlayer, SavedMotionControls, ExploreControls, type ExplorePanel } from './ExploreControls';
import { HotspotChips, HotspotNote, ModelCanvas, ToolbarButton, UnknownModel, ViewerHeader } from './ViewerParts';
import { useModelViewer } from './useModelViewer';
import type { ViewUpdate } from './types';

const PLAYER_PREFERENCE = '4212-explore-show-player';

// A preference store that survives private windows and blocked site data: it just forgets.
const readPlayerPreference = () => { try { return localStorage.getItem(PLAYER_PREFERENCE) !== 'false'; } catch { return true; } };
const writePlayerPreference = (value: boolean) => { try { localStorage.setItem(PLAYER_PREFERENCE, String(value)); } catch { /* not remembered */ } };

type ExploreViewerProps = {
  modelId: string;
  /** Inside a lesson step: shorter, controls start closed, no full-page buttons. */
  embedded?: boolean;
  view?: ViewUpdate;
  isFullPage?: boolean;
  isFullscreen?: boolean;
  onToggleFullPage?: () => void;
  onToggleFullscreen?: () => void;
};

/** The full viewer: canvas, hotspots, motion player and the Parts / Motion / Inside / Look panels. */
export default function ExploreViewer({ modelId, embedded = false, view, isFullPage = false, isFullscreen = false, onToggleFullPage, onToggleFullscreen }: ExploreViewerProps) {
  const viewer = useModelViewer(modelId, embedded ? lessonProfile(modelsById[modelId]?.adapter) : 'explore', view);
  const [panel, setPanel] = useState<ExplorePanel>('components');
  const [controlsOpen, setControlsOpen] = useState(!embedded);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [showPlayerOnViewer, setShowPlayerOnViewer] = useState(readPlayerPreference);
  const { definition, features, snapshot } = viewer;

  const filteredComponents = useMemo(() => {
    const items = features?.components?.items || [];
    const term = query.trim().toLowerCase();
    return items.filter((component) => inComponentGroup(component, group)
      && (!term || `${component.label} ${component.description}`.toLowerCase().includes(term)));
  }, [features?.components?.items, query, group]);

  if (!definition) return <UnknownModel modelId={modelId} />;

  const hasControlPanels = Boolean(features?.components || features?.motion || features?.section || features?.appearance);
  const panelOpen = controlsOpen && hasControlPanels;
  const height = embedded ? 'h-[75dvh] min-h-[36rem] lg:h-[32rem] lg:min-h-[24rem]' : 'h-full min-h-[22rem]';
  const setPlayerPreference = (value: boolean) => { setShowPlayerOnViewer(value); writePlayerPreference(value); };

  return <section className={`relative isolate flex flex-col overflow-hidden bg-[#071418] text-slate-100 shadow-inner lg:flex-row ${height}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${panelOpen ? 'min-h-[18rem]' : ''}`}>
      <ModelCanvas viewer={viewer} />
      <ViewerHeader viewer={viewer}>
        {onToggleFullPage && <ToolbarButton label={isFullPage ? 'Exit full-page viewer' : 'Use full-page viewer'} title={isFullPage ? 'Exit full-page viewer' : 'Use full-page viewer'} active={isFullPage} onClick={onToggleFullPage}>{isFullPage ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</ToolbarButton>}
        {onToggleFullscreen && <ToolbarButton label={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} title={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} active={isFullscreen} onClick={onToggleFullscreen}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</ToolbarButton>}
        {hasControlPanels && <ToolbarButton label={controlsOpen ? 'Hide Explore controls' : 'Show Explore controls'} active={controlsOpen} onClick={() => setControlsOpen((open) => !open)}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>}
      </ViewerHeader>

      {features?.hotspots && <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-slate-700/80 bg-[#07161b]/94 p-2 shadow-xl backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-[calc(100%-1.5rem)]">
        <HotspotChips viewer={viewer} />
        <HotspotNote viewer={viewer} className="px-1 pt-1.5" />
      </div>}

      {snapshot.assemblyNotice && <p className="pointer-events-none absolute inset-x-3 top-20 z-10 max-w-sm rounded-lg bg-[#07161b]/90 px-3 py-2 text-xs leading-relaxed text-amber-100">{snapshot.assemblyNotice}</p>}

      {features?.motion && !controlsOpen && showPlayerOnViewer && (features.savedMotions && snapshot.savedMotionId !== 'operating'
        ? <div className="absolute inset-x-3 bottom-3 z-20 max-h-[45%] overflow-y-auto rounded-xl border border-slate-700 bg-[#07161b]/95 p-3 sm:w-80"><SavedMotionControls features={features} snapshot={snapshot} /></div>
        : <CompactMotionPlayer motion={features.motion} snapshot={snapshot} />)}
    </div>

    {panelOpen && features && <ExploreControls
      definitionLabel={definition.label}
      features={features}
      snapshot={snapshot}
      panel={panel}
      onPanelChange={setPanel}
      onClose={() => setControlsOpen(false)}
      filteredComponents={filteredComponents}
      query={query}
      onQueryChange={setQuery}
      group={group}
      onGroupChange={(value) => { setGroup(value); features.components?.select(''); }}
      showPlayerOnViewer={showPlayerOnViewer}
      onShowPlayerOnViewerChange={setPlayerPreference}
    />}
  </section>;
}
