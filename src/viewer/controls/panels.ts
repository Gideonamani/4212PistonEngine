import type { LucideIcon } from 'lucide-react';
import { Box, Eye, Play, Scan, ScanEye } from 'lucide-react';
import { DEFAULT_FOCUS_MODE, FOCUS_MODE_LABELS } from '../core/focus-style.mjs';
import type { ModelViewerState } from '../useModelViewer';

/**
 * The controls a viewer can offer, one entry each. A lesson step and the Explore screen draw the same panels from the same entries;
 * what differs is only which entries a host offers, because `available` looks at what this model can do and where it is shown.
 * Something new for Explore (a measuring tool, a cycle lab) is one more entry here and one more panel body, and a lesson never shows it
 * unless it opts in.
 */

export type PanelId = 'parts' | 'motion' | 'spotlight' | 'section' | 'look';
export type PanelHost = 'explore' | 'lesson';

/** Where the controls are drawn, and what the model allows there: a lesson only offers a model's full set when the model opts in with `lessonControls`. */
export type PanelContext = { host: PanelHost; lessonControls: boolean };

export type PanelValue = { text: string; tone: 'amber' | 'teal' | 'muted' };

export type PanelDefinition = {
  id: PanelId;
  label: string;
  Icon: LucideIcon;
  available: (viewer: ModelViewerState, context: PanelContext) => boolean;
  /** The live state shown under the tab's name, so a closed panel still says what it is doing. */
  value?: (viewer: ModelViewerState, context: PanelContext) => PanelValue | undefined;
};

const wholeSet = ({ host, lessonControls }: PanelContext) => host === 'explore' || lessonControls;

/** Whether the learner may move the model's motion here. A lesson on a model that does not allow it only reports the pose the step holds. */
export const motionIsInteractive = wholeSet;

export const PANELS: Record<PanelId, PanelDefinition> = {
  parts: {
    id: 'parts',
    label: 'Parts',
    Icon: Box,
    available: ({ features }, context) => wholeSet(context) && Boolean(features?.components),
  },
  motion: {
    id: 'motion',
    label: 'Motion',
    Icon: Play,
    // Every lesson with a motion offers the tab: a model that lets the learner move it gets the player, the rest report the pose the step holds.
    available: ({ features }) => Boolean(features?.motion),
    value: ({ features, snapshot }, context) => {
      const crank = !snapshot.savedMotionId || snapshot.savedMotionId === 'operating' || !features?.savedMotions;
      const reading = crank ? `${Math.round(snapshot.angle ?? 0)}°` : `${Math.round(snapshot.motionProgress ?? 0)}%`;
      return { text: `${reading} · ${!motionIsInteractive(context) ? 'pose' : snapshot.playing ? 'playing' : 'paused'}`, tone: 'amber' };
    },
  },
  spotlight: {
    id: 'spotlight',
    label: 'Spotlight',
    Icon: ScanEye,
    // A lesson spotlights what the step names, so the choice appears only on such a step; in Explore it follows the learner's own selection.
    available: ({ features, snapshot }, { host }) => (host === 'explore' ? Boolean(features?.focus && features.components) : Boolean(features?.focus && snapshot.focusActive)),
    value: ({ snapshot }) => snapshot.focusActive ? { text: FOCUS_MODE_LABELS[snapshot.focusMode ?? DEFAULT_FOCUS_MODE], tone: 'teal' } : { text: 'Off', tone: 'muted' },
  },
  section: {
    id: 'section',
    label: 'Section',
    Icon: Scan,
    // A lesson offers the cut on a step that spotlights a part or recommends a plane, and for a model whose whole set it shows.
    available: ({ features, snapshot }, context) => Boolean(features?.section) && (wholeSet(context) || Boolean(snapshot.focusActive) || Boolean(snapshot.sectionRecommended)),
    value: ({ snapshot }) => snapshot.sectionEnabled
      ? { text: `On · ${snapshot.sectionOnRecommended ? 'R' : (snapshot.sectionAxis ?? 'z').toUpperCase()} plane`, tone: 'teal' }
      : { text: 'Off', tone: 'muted' },
  },
  look: {
    id: 'look',
    label: 'Look',
    Icon: Eye,
    available: ({ features }, context) => wholeSet(context) && Boolean(features?.appearance),
  },
};

/** The order the tabs run in, for every host. */
export const PANEL_ORDER: PanelId[] = ['parts', 'motion', 'spotlight', 'section', 'look'];

/** Whether there is anything to open: the lesson dock and Explore's panel each show their toggle only then. */
export const hasControlPanels = (viewer: ModelViewerState, context: PanelContext) => availablePanels(viewer, context).length > 0;

/** The panels this viewer offers right now, in tab order. */
export const availablePanels = (viewer: ModelViewerState, context: PanelContext): PanelDefinition[] => viewer.features ? PANEL_ORDER.map((id) => PANELS[id]).filter((panel) => panel.available(viewer, context)) : [];
