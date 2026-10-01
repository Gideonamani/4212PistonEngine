import * as THREE from 'three';

// Per-part winding counts fill solid cuts while leaving bores and cavities open.
// Helpers live outside the model so camera framing and picking use real parts only.
export function createSectionController(meshes, bounds, render, onChange, scene) {
  const plane = new THREE.Plane();
  const helpers = new THREE.Group();
  helpers.name = 'Section cut faces';
  scene.add(helpers);
  const capGeometry = new THREE.PlaneGeometry(bounds.getSize(new THREE.Vector3()).length() * 3, bounds.getSize(new THREE.Vector3()).length() * 3);
  const entries = meshes.map((source, index) => {
    const passes = [THREE.BackSide, THREE.FrontSide].map((side, sideIndex) => {
      const operation = sideIndex === 0 ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp;
      const material = new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false, depthTest: false,
        clippingPlanes: [plane], stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
        stencilFail: operation, stencilZFail: operation, stencilZPass: operation });
      const mesh = new THREE.Mesh(source.geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = index * 3 + 1;
      helpers.add(mesh);
      return mesh;
    });
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.1, roughness: 0.65,
      stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp });
    const cap = new THREE.Mesh(capGeometry, material);
    cap.frustumCulled = false;
    cap.renderOrder = index * 3 + 2;
    cap.onAfterRender = renderer => renderer.clearStencil();
    helpers.add(cap);
    return { source, passes, cap };
  });
  let enabled = false, position = 50, flipped = true;
  /** @type {'x' | 'y' | 'z'} */
  let axis = 'z';
  const sync = () => {
    helpers.visible = enabled;
    if (!enabled) return;
    for (const { source, passes, cap } of entries) {
      const materials = Array.isArray(source.material) ? source.material : [source.material];
      const appearance = materials[0];
      let visible = materials.some(material => material.visible && material.opacity >= 1);
      for (let node = source; node; node = node.parent) visible &&= node.visible;
      for (const pass of passes) {
        pass.visible = visible;
        pass.matrix.copy(source.matrixWorld);
        pass.morphTargetInfluences = source.morphTargetInfluences;
      }
      cap.visible = visible;
      if (appearance.color) cap.material.color.copy(appearance.color);
      plane.projectPoint(bounds.getCenter(cap.position), cap.position);
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
    }
  };
  const apply = () => {
    const point = bounds.getCenter(new THREE.Vector3());
    point[axis] += bounds.getSize(new THREE.Vector3())[axis] * (position - 50) / 100;
    const normal = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    if (flipped) normal.negate();
    plane.setFromNormalAndCoplanarPoint(normal, point);
    for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const changed = Boolean(material.clippingPlanes?.length) !== enabled;
      material.clippingPlanes = enabled ? [plane] : [];
      if (changed) material.needsUpdate = true;
    }
    sync(); render(); onChange();
  };
  return {
    snapshot: () => ({ sectionEnabled: enabled, sectionAxis: axis, sectionPosition: position, sectionFlipped: flipped }),
    feature: {
      setEnabled(value) { enabled = value; apply(); },
      setAxis(value) { axis = value; apply(); },
      setPosition(value) { position = Math.max(0, Math.min(100, value)); apply(); },
      flip() { flipped = !flipped; apply(); },
      reset() { enabled = false; axis = 'z'; position = 50; flipped = true; apply(); },
    },
    sync, refresh: apply,
    dispose() {
      scene.remove(helpers);
      capGeometry.dispose();
      for (const { passes, cap } of entries) { for (const pass of passes) pass.material.dispose(); cap.material.dispose(); }
    },
  };
}
