import { useEffect, useMemo, useReducer, useState } from 'react';
import { groupComponentIds, inComponentGroup } from '../core/component-groups.mjs';
import { createPartSelection } from '../core/part-selection.mjs';
import type { FocusMode, ModelComponent } from '../types';
import type { ModelViewerState } from '../useModelViewer';
import type { PlayerPreference } from './MotionPanel';
import { availablePanels, type PanelContext, type PanelDefinition, type PanelHost, type PanelId } from './panels';

export type ViewerControlsOptions = {
  host: PanelHost;
  /** A lesson: whether the model opts in to its whole set of panels (Parts, Motion, Look) and not only the ones a step calls for. */
  lessonControls?: boolean;
  /** A lesson: called with the style the learner chooses for the spotlight, so it can be remembered for the next step and the next visit. */
  chooseFocusMode?: (mode: FocusMode) => void;
  /** Explore: the "show the player on the viewer" preference of the Motion tab. */
  player?: PlayerPreference;
};

/** What a spotlight would be aimed at in Explore: the part the learner selected, else the whole subassembly they chose. */
export type SpotlightTarget = { ids: string[]; label: string };

export type ViewerControls = {
  host: PanelHost;
  context: PanelContext;
  panels: PanelDefinition[];
  /** The open panel; null while they are all closed (a lesson's dock starts that way). */
  active: PanelId | null;
  /** Open a panel. In a lesson, opening the open one closes it. */
  select: (id: PanelId) => void;
  close: () => void;
  player?: PlayerPreference;
  parts: {
    query: string;
    setQuery: (value: string) => void;
    group: string;
    setGroup: (value: string) => void;
    filtered: ModelComponent[];
    selectedIds: string[];
    togglePart: (id: string) => void;
    selectSinglePart: (id: string) => void;
    toggleGroup: (groupId: string) => void;
    clearSelected: () => void;
    selectAllFiltered: () => void;
  };
  spotlight: {
    /** How it is drawn now; undefined while there is no spotlight. */
    current?: FocusMode;
    choose: (mode: FocusMode) => void;
    isolatePart: (id: string) => void;
    /** Explore only. */
    target: SpotlightTarget;
  };
};

/**
 * Everything the controls panels share, kept for as long as the viewer lives so that closing and reopening them loses nothing: which
 * panel is open, the Parts search and subassembly filter, and what the Spotlight is aimed at. A lesson's dock and Explore's side panel
 * both draw their tabs and bodies from the object this returns.
 */
export function useViewerControls(viewer: ModelViewerState, { host, lessonControls = false, chooseFocusMode, player }: ViewerControlsOptions): ViewerControls {
  const { features, snapshot } = viewer;
  const context = useMemo<PanelContext>(() => ({ host, lessonControls }), [host, lessonControls]);
  const panels = availablePanels(viewer, context);
  // Explore opens on Parts. A lesson's dock starts with every panel closed, except that a model with a player opens it: the player is the point of such a step.
  const [open, setOpen] = useState<PanelId | null>(host === 'explore' ? 'parts' : lessonControls ? 'motion' : null);
  const [query, setQuery] = useState('');
  const [group, setGroupState] = useState('');
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  // Lessons keep their step-directed spotlight; only Explore's selection aims one automatically.
  const lessonSelection = useMemo(() => host === 'lesson' && features?.components && viewer.session
    ? createPartSelection({ ...features, focus: undefined }, viewer.session.snapshot, refresh)
    : undefined, [features, viewer.session, host]);
  const selection = host === 'explore' ? viewer.partSelection : lessonSelection;
  const selectedPartIds = selection?.selectedIds() ?? [];

  // Each loaded model owns its controller. IDs and filters from another model never carry over.
  useEffect(() => { setQuery(''); setGroupState(''); }, [selection]);
  useEffect(() => {
    if (host !== 'explore' || !selection) return;
    return viewer.handlePartPicks((id) => { setGroupState(''); selection.select(id); });
  }, [host, selection, viewer.handlePartPicks]);

  // Explore always has a panel open (the first one the model offers, if the remembered one is not there); a lesson's dock may be all closed.
  const active = panels.some((panel) => panel.id === open) ? open : host === 'explore' ? panels[0]?.id ?? null : null;

  const filtered = useMemo(() => {
    const items = features?.components?.items || [];
    const term = query.trim().toLowerCase();
    return items.filter((component) => inComponentGroup(component, group)
      && (!term || `${component.label} ${component.description} ${component.searchText ?? ''}`.toLowerCase().includes(term)));
  }, [features?.components?.items, query, group]);

  const setGroup = (value: string) => {
    setGroupState(value);
    selection?.replace(value && value !== 'all' ? groupComponentIds(features!.components!.items, value) : []);
  };

  // The target comes only from explicit selection actions, never from a stale inspected ID.
  const target = useMemo<SpotlightTarget>(() => {
    const components = features?.components;
    if (!components) return { ids: [], label: '' };
    if (selectedPartIds.length > 0) {
      if (selectedPartIds.length === 1) {
        const item = components.items.find((component) => component.id === selectedPartIds[0]);
        return { ids: selectedPartIds, label: item?.label ?? selectedPartIds[0] };
      }
      return { ids: selectedPartIds, label: `${selectedPartIds.length} components` };
    }
    return { ids: [], label: '' };
  }, [features?.components, selectedPartIds]);

  const current: FocusMode | undefined = snapshot.focusActive ? snapshot.focusMode : undefined;

  const togglePart = (id: string) => selection?.toggle(id);

  const selectSinglePart = (id: string) => {
    setGroupState('');
    selection?.select(id);
  };

  const toggleGroup = (groupId: string) => {
    const components = features?.components;
    if (!components) return;
    const groupIds = groupComponentIds(components.items, groupId) as string[];
    selection?.toggleMany(groupIds);
  };

  const clearSelected = () => {
    setGroupState('');
    selection?.clear();
  };

  const selectAllFiltered = () => {
    selection?.add(filtered.map((c) => c.id));
  };

  const choose = (mode: FocusMode) => {
    const focus = features?.focus;
    if (!focus) return;
    if (host === 'lesson') { (chooseFocusMode ?? focus.setMode)(mode); return; }
    selection?.choose(mode);
  };

  return {
    host,
    context,
    panels,
    active,
    select: (id) => setOpen(host === 'lesson' && active === id ? null : id),
    close: () => setOpen(null),
    player,
    parts: {
      query,
      setQuery,
      group,
      setGroup,
      filtered,
      selectedIds: selectedPartIds,
      togglePart,
      selectSinglePart,
      toggleGroup,
      clearSelected,
      selectAllFiltered,
    },
    spotlight: { current, choose, target, isolatePart: (id) => { setGroupState(''); selection?.isolate(id); } },
  };
}
