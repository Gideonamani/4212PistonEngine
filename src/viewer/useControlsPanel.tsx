import React, { useMemo, useState } from 'react';
import { inComponentGroup } from './core/component-groups.mjs';
import { ExploreControls, type ExplorePanel } from './ExploreControls';
import type { ModelViewerState } from './useModelViewer';

export type PlayerPreference = { show: boolean; onChange: (value: boolean) => void };

/**
 * The Parts / Motion / Inside / Look panel, with the tab, search text and subassembly filter kept for as long as the viewer lives (so
 * closing and reopening the panel does not lose them). Returns a function that draws the panel; call it only while the panel is open.
 */
export function useControlsPanel(viewer: ModelViewerState) {
  const { definition, features, snapshot } = viewer;
  const [panel, setPanel] = useState<ExplorePanel>('components');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');

  const filteredComponents = useMemo(() => {
    const items = features?.components?.items || [];
    const term = query.trim().toLowerCase();
    return items.filter((component) => inComponentGroup(component, group)
      && (!term || `${component.label} ${component.description}`.toLowerCase().includes(term)));
  }, [features?.components?.items, query, group]);

  return (onClose: () => void, player?: PlayerPreference): React.ReactNode => features ? <ExploreControls
    definitionLabel={definition.label}
    features={features}
    snapshot={snapshot}
    panel={panel}
    onPanelChange={setPanel}
    onClose={onClose}
    filteredComponents={filteredComponents}
    query={query}
    onQueryChange={setQuery}
    group={group}
    onGroupChange={(value) => { setGroup(value); features.components?.select(''); }}
    showPlayerOnViewer={player?.show}
    onShowPlayerOnViewerChange={player?.onChange}
  /> : null;
}

/** Whether a model has anything for the panel to show. */
export const hasControlPanels = (viewer: ModelViewerState) => Boolean(viewer.features?.components || viewer.features?.motion || viewer.features?.section || viewer.features?.appearance);
