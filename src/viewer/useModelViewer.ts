import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { modelsById } from '../data/modelRegistry';
import { createModelSession } from './adapters';
import { createViewerRuntime } from './core/runtime';
import { focusModeOrDefault } from './core/focus-style.mjs';
import { spotlightFor } from './core/step-part-chips.mjs';
import { viewKey } from './core/view-state.mjs';
import type { WheelZoom } from './core/interaction.mjs';
import type { FocusMode, InteractionMode, ViewUpdate, ViewerProfile, ViewerRuntime, ViewerSession, ViewerSnapshot } from './types';

/**
 * Owns one loaded model: it creates the scene runtime, loads the model once per model and profile, and then applies the view a
 * lesson step asks for (pose, cues, spotlight) to the loaded scene instead of rebuilding it.
 *
 * `preferredFocusMode` is the learner's own choice of how a spotlight is drawn. It wins over the step's `focusMode` on every step, and
 * changing it redraws the current spotlight without moving the camera.
 */
export function useModelViewer(modelId: string, profile: ViewerProfile, view: ViewUpdate = {}, preferredFocusMode?: FocusMode) {
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
  const preferredFocusRef = useRef(preferredFocusMode);
  preferredFocusRef.current = preferredFocusMode;
  // The view with the learner's own focus mode laid over the step's, if they have chosen one.
  const effectiveView = (): ViewUpdate => ({ ...viewRef.current, focusMode: preferredFocusRef.current ?? viewRef.current.focusMode });
  const appliedViewKey = useRef('');
  // Whether the spotlight on show is a preview of some of the step's parts (see previewPart) and not the step's own.
  const previewing = useRef(false);

  const applyView = (target: ViewerSession) => {
    const key = viewKey(viewRef.current);
    if (key === appliedViewKey.current) return;
    appliedViewKey.current = key;
    previewing.current = false;
    try { target.update?.(effectiveView()); } catch (reason) { console.error(reason); setError(reason instanceof Error ? reason.message : 'The 3D view could not be updated.'); }
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
    previewing.current = false;
    createModelSession(definition, {
      runtime,
      profile,
      signal: controller.signal,
      ...effectiveView(),
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

  // A new choice redraws the spotlight that is already showing; the next step then starts from it too.
  useEffect(() => {
    if (preferredFocusMode) sessionRef.current?.features.focus?.setMode(preferredFocusMode);
  }, [preferredFocusMode]);

  /**
   * Spotlight just this part, drawn in the style the learner would see anyway, until the step changes or this is called with nothing,
   * which goes back to the step's own spotlight. Unlike a view change it leaves the pose and the camera where they are (the camera moves
   * only to frame an isolated part), so it is for a learner looking at the step's parts one by one.
   */
  const previewPart = useCallback((id?: string) => {
    const focus = sessionRef.current?.features.focus;
    if (!focus || (!id && !previewing.current)) return;
    const mode = focusModeOrDefault(effectiveView().focusMode);
    try {
      previewing.current = Boolean(id);
      focus.set(spotlightFor(id, viewRef.current.focusParts), mode);
    } catch (reason) {
      console.error(reason);
    }
  }, []);

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
    previewPart,
  };
}

export type ModelViewerState = ReturnType<typeof useModelViewer>;
