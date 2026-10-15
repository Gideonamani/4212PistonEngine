import React from 'react';
import type { ModelViewerState } from '../useModelViewer';
import { LookPanel } from './LookPanel';
import { MotionPanel } from './MotionPanel';
import { PartsPanel } from './PartsPanel';
import { SectionPanel } from './SectionPanel';
import { SpotlightPanel } from './SpotlightPanel';
import { panelDomId } from './DockTabs';
import type { PanelId } from './panels';
import type { ViewerControls } from './useViewerControls';

/** The body of the open panel, wrapped as the tab panel its tab controls. */
export function ControlsBody({
  id,
  viewer,
  controls,
  className = '',
  showPartCard,
  onToggleShowPartCard,
}: {
  id: PanelId;
  viewer: ModelViewerState;
  controls: ViewerControls;
  className?: string;
  showPartCard?: boolean;
  onToggleShowPartCard?: () => void;
}) {
  const { definition, features, snapshot } = viewer;
  if (!features) return null;
  const { spotlight, parts } = controls;
  return <div role="tabpanel" id={panelDomId(id, 'panel')} aria-labelledby={panelDomId(id, 'tab')} className={className}>
    {id === 'parts' && <PartsPanel
      definitionLabel={definition.label}
      features={features}
      snapshot={snapshot}
      filteredComponents={parts.filtered}
      query={parts.query}
      onQueryChange={parts.setQuery}
      group={parts.group}
      onGroupChange={parts.setGroup}
      selectedIds={parts.selectedIds}
      onTogglePart={parts.togglePart}
      onSelectSinglePart={parts.selectSinglePart}
      onToggleGroup={parts.toggleGroup}
      onClearSelected={parts.clearSelected}
      currentFocusMode={spotlight.current}
      onChooseFocusMode={spotlight.choose}
    />}
    {id === 'motion' && <MotionPanel features={features} snapshot={snapshot} host={controls.host} player={controls.player} />}
    {id === 'spotlight' && (controls.host === 'explore'
      ? <SpotlightPanel
          current={spotlight.current}
          onChoose={spotlight.choose}
          disabled={!spotlight.target.ids.length}
          status={spotlight.target.ids.length ? <>Spotlight on <strong className="text-white">{spotlight.target.label}</strong>.</> : 'Choose a part or a subassembly in Parts, then choose how to show it.'}
          idleHint="Tap a style to spotlight it. Tap the same style again to switch it off."
          highlightFallback={snapshot.focusFallback}
          showPartCard={showPartCard}
          onToggleShowPartCard={onToggleShowPartCard}
        />
      : <SpotlightPanel current={spotlight.current} onChoose={spotlight.choose} highlightFallback={snapshot.focusFallback} />)}
    {id === 'section' && <SectionPanel viewer={viewer} extras={controls.host === 'explore'} />}
    {id === 'look' && <LookPanel features={features} snapshot={snapshot} />}
  </div>;
}
