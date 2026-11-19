// Pulling a model apart in a part quiz: the model's own exploded view, driven by a slider in layers, so a learner reaches a part that sits
// inside others with one drag and one tap instead of hiding the parts around it one by one. Only a model whose saved motions include an
// exploded view offers it (see models.json `capabilities`); the others keep Hide as their way in.
//
// The slider never names a stage ("Valve trains" would say where to look), only how far apart the model is: "Assembled", "Layer 2 of 4".

/** Saved motions that put the model back together, or move it for some other reason, are not a pull-apart. */
const NOT_APART = /reassembl|collapse|removal|operating|cycle|focus|relief/i;

/**
 * The saved motion that pulls this model apart, with the points the slider stops at, or undefined for a model that has none.
 * `items` are the viewer's `features.savedMotions.items`: the cylinder calls it `exploded`, the studies "Exploded overview",
 * "Systems exploded view" or "Explode - illustrative layout".
 * @param {{ id: string, label?: string, stages?: { progress: number }[] }[] | undefined} items
 * @returns {{ id: string, stops: number[] } | undefined}
 */
export function pullApartMotion(items) {
  const motion = (items ?? []).find((item) => /explod/i.test(`${item.id} ${item.label ?? ''}`) && !NOT_APART.test(`${item.id} ${item.label ?? ''}`));
  if (!motion) return undefined;
  const stops = [...new Set([0, ...(motion.stages ?? []).map((stage) => Math.round(stage.progress * 1000) / 1000), 100])]
    .filter((value) => value >= 0 && value <= 100)
    .sort((a, b) => a - b);
  // A motion with no stages still pulls apart: assembled, then apart.
  return { id: motion.id, stops };
}

/** The layer (an index into `stops`) a motion's progress is at: the nearest stop. */
export function layerAt(progress, stops) {
  let best = 0;
  for (let index = 1; index < stops.length; index += 1) if (Math.abs(stops[index] - progress) < Math.abs(stops[best] - progress)) best = index;
  return best;
}

/** What the slider says for a layer: never a stage's name. `layers` is the number of layers beyond the assembled model. */
export const layerLabel = (layer, layers) => (layer <= 0 ? 'Assembled' : layer >= layers ? `Fully apart (layer ${layers} of ${layers})` : `Layer ${layer} of ${layers}`);
