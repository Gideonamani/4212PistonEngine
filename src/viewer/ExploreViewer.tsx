import React, { useState } from 'react';
import { Maximize2, Minimize2, MousePointerClick, SlidersHorizontal } from 'lucide-react';
import { ExploreControls } from './ExploreControls';
import { CompactMotionPlayer } from './controls/MotionPlayers';
import { useViewerControls } from './controls/useViewerControls';
import { HotspotChips, HotspotNote, ModelCanvas, ToolbarButton, UnknownModel, ViewerHeader } from './ViewerParts';
import { useModelViewer } from './useModelViewer';
import { PartCard } from './PartCard';

const PLAYER_PREFERENCE = '4212-explore-show-player';
const SHOW_PART_CARD_PREFERENCE = '4212-explore-show-part-card';

// Preference stores that survive private windows and blocked site data: they just forget.
const readPlayerPreference = () => { try { return localStorage.getItem(PLAYER_PREFERENCE) !== 'false'; } catch { return true; } };
const writePlayerPreference = (value: boolean) => { try { localStorage.setItem(PLAYER_PREFERENCE, String(value)); } catch { /* not remembered */ } };

const readShowPartCardPreference = () => { try { return localStorage.getItem(SHOW_PART_CARD_PREFERENCE) !== 'false'; } catch { return true; } };
const writeShowPartCardPreference = (value: boolean) => { try { localStorage.setItem(SHOW_PART_CARD_PREFERENCE, String(value)); } catch { /* not remembered */ } };

type ExploreViewerProps = {
  modelId: string;
  isFullPage?: boolean;
  isFullscreen?: boolean;
  onToggleFullPage?: () => void;
  onToggleFullscreen?: () => void;
};

/**
 * The Explore screen's viewer: the canvas with its round tool buttons, hotspots and the motion player, and the controls panel (the model's
 * description and how to move it, then the Parts / Motion / Spotlight / Section / Look tabs). No text sits over the model itself.
 */
export default function ExploreViewer({ modelId, isFullscreen = false, onToggleFullscreen }: ExploreViewerProps) {
  const viewer = useModelViewer(modelId, 'explore');
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showPlayerOnViewer, setShowPlayerOnViewer] = useState(readPlayerPreference);
  const [showPartCard, setShowPartCard] = useState(readShowPartCardPreference);

  const setPlayerPreference = (value: boolean) => { setShowPlayerOnViewer(value); writePlayerPreference(value); };
  const toggleShowPartCard = () => {
    setShowPartCard((prev) => {
      const next = !prev;
      writeShowPartCardPreference(next);
      return next;
    });
  };

  const controls = useViewerControls(viewer, { host: 'explore', player: { show: showPlayerOnViewer, onChange: setPlayerPreference } });
  const { definition, features, snapshot } = viewer;

  if (!definition) return <UnknownModel modelId={modelId} />;

  // The panel appears once the model has loaded, and carries the description even for a model with no tabs (a scan with only a guided tour).
  const hasPanel = Boolean(features);
  const panelOpen = controlsOpen && hasPanel;

  return <section className="relative isolate flex h-full min-h-[22rem] flex-col overflow-hidden bg-stage text-slate-100 shadow-inner lg:flex-row" aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${panelOpen ? 'min-h-[18rem]' : ''}`}>
      <ModelCanvas viewer={viewer} />
      <ViewerHeader viewer={viewer}>
        <ToolbarButton
          label={showPartCard ? 'Disable part details on click' : 'Enable part details on click'}
          title={showPartCard ? 'Inspect parts on click: ON (click to disable)' : 'Inspect parts on click: OFF (click to enable)'}
          active={showPartCard}
          onClick={toggleShowPartCard}
        >
          <MousePointerClick className="h-4 w-4" />
        </ToolbarButton>
        {onToggleFullscreen && <ToolbarButton label={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} title={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} active={isFullscreen} onClick={onToggleFullscreen}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</ToolbarButton>}
        {hasPanel && <ToolbarButton label={controlsOpen ? 'Hide Explore controls' : 'Show Explore controls'} title={controlsOpen ? 'Hide Explore controls' : 'Show Explore controls'} active={controlsOpen} onClick={() => setControlsOpen((open) => !open)}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>}
      </ViewerHeader>

      {features?.hotspots && <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-slate-700/80 bg-panel/94 p-2 shadow-xl backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-[calc(100%-1.5rem)]">
        <HotspotChips viewer={viewer} />
        <HotspotNote viewer={viewer} className="px-1 pt-1.5" />
      </div>}

      {showPartCard && snapshot.selectedId && (
        <div
          className="absolute z-20 pointer-events-auto transition-all duration-200 w-auto max-w-[50%] top-3 left-3 max-h-[50vh] overflow-y-auto sm:top-auto sm:left-auto sm:bottom-3 sm:right-3 sm:max-w-xs sm:w-80"
        >
          <PartCard
            partId={snapshot.selectedId}
            learner={snapshot.selectedDetails}
            defaultLabel={snapshot.selectedLabel}
            defaultFunction={snapshot.selectedDescription}
            onClose={() => features?.components?.select('')}
            onIsolatePart={(id) => {
              features?.focus?.set([id], 'isolate');
            }}
            isIsolated={
              snapshot.focusMode === 'isolate' &&
              (snapshot.selectedId === snapshot.selectedId ||
                (controls.parts.selectedIds.length === 1 && controls.parts.selectedIds[0] === snapshot.selectedId))
            }
            onUnisolate={() => {
              features?.components?.showAll();
              controls.parts.clearSelected();
            }}
            className="w-full"
          />
        </div>
      )}

      {features?.motion && !controlsOpen && showPlayerOnViewer && (
        <CompactMotionPlayer features={features} snapshot={snapshot} />
      )}
    </div>

    {panelOpen && (
      <ExploreControls
        viewer={viewer}
        controls={controls}
        onClose={() => setControlsOpen(false)}
        showPartCard={showPartCard}
        onToggleShowPartCard={toggleShowPartCard}
      />
    )}
  </section>;
}
