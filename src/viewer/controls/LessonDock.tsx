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
  return <div className="space-y-2.5 px-3 pb-1 pt-2.5">
    <DockTabs viewer={viewer} panels={controls.panels} context={controls.context} open={controls.active} onSelect={controls.select} />
    {controls.active && <ControlsBody id={controls.active} viewer={viewer} controls={controls} className="rounded-[1.25rem] border border-white/15 bg-slate-900/70 p-3.5" />}
  </div>;
}
