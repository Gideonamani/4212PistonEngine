// The view a lesson step asks of an already-loaded model: pose, cycle cues and spotlight. Pure helpers, shared by the lesson
// components and tested without a browser.

/** The ViewUpdate fields, in the order used to compare two views. */
export const VIEW_FIELDS = ['savedMotionId', 'motionProgress', 'initialAngle', 'initialCycle', 'viewPreset', 'focusHotspots', 'focusParts'];

/** A stable string for a view, so the viewer re-applies it only when something it shows has really changed. */
export function viewKey(view) {
  return JSON.stringify(VIEW_FIELDS.map((field) => view?.[field]));
}

/** The view a model-pose lesson step asks for. */
export function viewFromStep(step) {
  return {
    savedMotionId: step.savedMotionId,
    motionProgress: step.motionProgress,
    initialAngle: typeof step.action?.value === 'number' ? step.action.value : undefined,
    initialCycle: step.action?.type === 'cycle-angle',
    viewPreset: step.viewPreset,
    focusHotspots: step.focusHotspots,
    focusParts: step.focusParts,
  };
}

/** Static scans keep free orbit in lessons; animated and operating models run the guided "dynamic" profile. */
export function lessonProfile(adapter) {
  return adapter === 'static-gltf' ? 'lesson-reference' : 'lesson-dynamic';
}
