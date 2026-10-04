import { useEffect, useReducer, useRef, useState } from 'react';
import { modelsById } from '../data/modelRegistry';
import { createModelSession } from './adapters';
import { createViewerRuntime } from './core/runtime';
import { viewKey } from './core/view-state.mjs';
import type { WheelZoom } from './core/interaction.mjs';
import type { InteractionMode, ViewUpdate, ViewerProfile, ViewerRuntime, ViewerSession, ViewerSnapshot } from './types';

/**
 * Owns one loaded model: it creates the scene runtime, loads the model once per model and profile, and then applies the view a
 * lesson step asks for (pose, cues, spotlight) to the loaded scene instead of rebuilding it.
 */
export function useModelViewer(modelId: string, profile: ViewerProfile, view: ViewUpdate = {}) {
  const definition = modelsById[modelId];
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ViewerRuntime | undefined>(undefined);
  const sessionRef = useRef<ViewerSession | undefined>(undefined);
  const [loadState, setLoadState] = useState<ViewerSnapshot>({ status: 'Preparing 3D viewer…', progress: 0 });
  const [error, setError] = useState('');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('orbit');
  const [wheelHint, setWheelHint] = useState(false);
  const wheelHintTimer = useRef(0);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  // Inside a lesson the page scrolls, so the mouse wheel zooms only with Ctrl or Cmd held; Explore owns the screen and zooms freely.
  const wheelZoom: WheelZoom = profile === 'explore' ? 'always' : 'modifier';

  const viewRef = useRef(view);
  viewRef.current = view;
  const appliedViewKey = useRef('');

  const applyView = (target: ViewerSession) => {
    const key = viewKey(viewRef.current);
    if (key === appliedViewKey.current) return;
    appliedViewKey.current = key;
    try { target.update?.(viewRef.current); } catch (reason) { console.error(reason); setError(reason instanceof Error ? reason.message : 'The 3D view could not be updated.'); }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !definition) return;
    const controller = new AbortController();
    const runtime = createViewerRuntime(mount, {
      wheelZoom,
      onWheelPassed: () => {
        setWheelHint(true);
        window.clearTimeout(wheelHintTimer.current);
        wheelHintTimer.current = window.setTimeout(() => setWheelHint(false), 1800);
      },
    });
    runtimeRef.current = runtime;
    setError('');
    // A fresh runtime starts in orbit mode, so the toggle must too (a lesson can move to another model while Pan is on).
    setInteractionMode('orbit');
    setLoadState({ status: 'Preparing 3D viewer…', progress: 0 });
    let disposed = false;
    appliedViewKey.current = viewKey(viewRef.current);
    createModelSession(definition, {
      runtime,
      profile,
      signal: controller.signal,
      ...viewRef.current,
      onChange: () => { if (!disposed) refresh(); },
      onProgress: (status, progress) => { if (!disposed) setLoadState({ status, progress }); },
    }).then((session) => {
      if (disposed) { session.dispose(); return; }
      sessionRef.current = session;
      applyView(session);
      setLoadState(session.snapshot());
      refresh();
    }).catch((reason: unknown) => {
      if (disposed || controller.signal.aborted) return;
      console.error(reason);
      setError(reason instanceof Error ? reason.message : 'The 3D model could not be loaded.');
    });

    return () => {
      disposed = true;
      window.clearTimeout(wheelHintTimer.current);
      controller.abort();
      sessionRef.current?.dispose();
      sessionRef.current = undefined;
      runtime.dispose();
      runtimeRef.current = undefined;
    };
  }, [definition, modelId, profile, wheelZoom]);

  const currentViewKey = viewKey(view);
  useEffect(() => {
    if (sessionRef.current) applyView(sessionRef.current);
  }, [currentViewKey]);

  const session = sessionRef.current;
  return {
    definition,
    mountRef,
    runtimeRef,
    session,
    features: session?.features,
    snapshot: session?.snapshot() || loadState,
    error,
    interactionMode,
    wheelZoom,
    /** True for a moment after a wheel turn was left to the page, so the viewer can explain that zooming needs Ctrl or Cmd. */
    wheelHint,
    togglePan() {
      const next: InteractionMode = interactionMode === 'pan' ? 'orbit' : 'pan';
      setInteractionMode(next);
      runtimeRef.current?.setInteractionMode(next);
    },
    resetView() { runtimeRef.current?.resetView(); },
  };
}

export type ModelViewerState = ReturnType<typeof useModelViewer>;
