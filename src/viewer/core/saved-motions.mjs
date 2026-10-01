import * as THREE from 'three';
export function explosionAmount(progress, stage, stageCount) {
  return Math.max(0, Math.min(1, progress * stageCount / 100 - stage + 1));
}
export function createExplodedMotion(meshes, profile) {
  const entries = meshes.map(mesh => {
    const id = mesh.userData.partId || mesh.userData.cad_part_id;
    if (!profile.parts[id]) throw Error(`Saved motion has no component: ${id}`);
    return { mesh, bind: mesh.matrixWorld.clone(), ...profile.parts[id] };
  });
  return {
    apply(progress, reverse = false) {
      const fraction = reverse ? 100 - progress : progress;
      for (const { mesh, bind, stage, offset_m } of entries) {
        const amount = explosionAmount(fraction, stage, profile.stages.length - 1);
        const world = new THREE.Matrix4().makeTranslation(...offset_m.map(value => value * amount)).multiply(bind);
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
