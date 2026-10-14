import React from 'react';
import type { ModelViewerState } from '../useModelViewer';
import { ControlsBody } from './ControlsBody';
import { DockTabs } from './DockTabs';
import type { ViewerControls } from './useViewerControls';

/**
 * The controls under a lesson's 3D model: a row of tabs, each saying what it is doing (Section: "On · R plane"), and the panel of the
 * one the learner opened. A tab opens a panel with a tap and closes it with another.
 */
export function LessonDock({ viewer, controls }: { viewer: ModelViewerState; controls: ViewerControls }) {
  if (!controls.panels.length) return null;
  return <div className="px-3 pb-2 pt-1">
    <DockTabs viewer={viewer} panels={controls.panels} context={controls.context} open={controls.active} onSelect={controls.select} />
    {controls.active && <ControlsBody id={controls.active} viewer={viewer} controls={controls} className="pt-3 pb-1 px-0.5" />}
  </div>;
}
