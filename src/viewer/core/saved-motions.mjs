import * as THREE from 'three';
export function explosionAmount(progress, stage, stageCount) {
  return Math.max(0, Math.min(1, progress * stageCount / 100 - stage + 1));
}
/**
 * A part's moves in a saved motion. A part either moves once (`stage` and `offset_m`, as in the exploded overview) or several times in
 * turn (`moves`, each a stage and an offset): a valve leaves with its cylinder and then comes out of it. An empty `moves` stays put.
 */
export const movesOf = (part) => part.moves ?? [{ stage: part.stage, offset_m: part.offset_m }];

/** Where a part is at a point in the motion: the sum of its moves, each as far along as its stage is. */
export function offsetAt(part, progress, stageCount) {
  const offset = [0, 0, 0];
  for (const { stage, offset_m } of movesOf(part)) {
    const amount = explosionAmount(progress, stage, stageCount);
    for (let axis = 0; axis < 3; axis += 1) offset[axis] += offset_m[axis] * amount;
  }
  return offset;
}

/** The points a step forward or back stops at: each stage's start. */
export const stopsOf = (stages) => stages.map(stage => stage.progress);

export function createExplodedMotion(meshes, profile) {
  const entries = meshes.map(mesh => {
    const id = mesh.userData.partId || mesh.userData.cad_part_id;
    if (!profile.parts[id]) throw Error(`Saved motion has no component: ${id}`);
    return { mesh, bind: mesh.matrixWorld.clone(), part: profile.parts[id] };
  });
  return {
    apply(progress, reverse = false) {
      const fraction = reverse ? 100 - progress : progress;
      for (const { mesh, bind, part } of entries) {
        const world = new THREE.Matrix4().makeTranslation(...offsetAt(part, fraction, profile.stages.length - 1)).multiply(bind);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(mesh.parent.matrixWorld).invert().multiply(world);
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
      }
    },
    stage(progress, reverse = false) {
      const fraction = reverse ? 100 - progress : progress;
      return [...profile.stages].reverse().find(stage => fraction >= stage.progress) || profile.stages[0];
    },
  };
}
