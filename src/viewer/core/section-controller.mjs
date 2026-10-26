import * as THREE from 'three';

// Per-part winding counts fill solid cuts while leaving bores and cavities open.
// Helpers live outside the model so camera framing and picking use real parts only.
// `onPlane` runs whenever the cut is turned on or off or the plane moves, before the frame is drawn (the spotlight's style can depend on it).
export function createSectionController(meshes, bounds, render, onChange, scene, onPlane) {
  bounds = bounds.clone();
  const plane = new THREE.Plane();
  const helpers = new THREE.Group();
  helpers.name = 'Section cut faces';
  scene.add(helpers);
  const capGeometry = new THREE.PlaneGeometry(1, 1);
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
  // A lesson step can name a plane chosen for seeing its component best (see sectionPlaneSpec). It is offered next to X, Y and Z, and
  // while it is the one in force the cut slides along its own normal instead of along an axis.
  /** @type {{ label: string, normal: [number, number, number], offset: number } | null} */
  let recommended = null;
  let onRecommended = false;
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
      cap.scale.setScalar(bounds.getSize(new THREE.Vector3()).length() * 3);
      if (appearance.color) cap.material.color.copy(appearance.color);
      plane.projectPoint(bounds.getCenter(cap.position), cap.position);
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
    }
  };
  const apply = () => {
    const point = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const normal = new THREE.Vector3();
    if (onRecommended && recommended) {
      normal.fromArray(recommended.normal).normalize();
      // How far the box reaches along the normal, so 0 to 100 per cent sweeps the plane from one side of the model to the other.
      point.addScaledVector(normal, (Math.abs(normal.x) * size.x + Math.abs(normal.y) * size.y + Math.abs(normal.z) * size.z) * (position - 50) / 100);
    } else {
      point[axis] += size[axis] * (position - 50) / 100;
      normal.setComponent(['x', 'y', 'z'].indexOf(axis), 1);
    }
    if (flipped) normal.negate();
    plane.setFromNormalAndCoplanarPoint(normal, point);
    for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const changed = Boolean(material.clippingPlanes?.length) !== enabled;
      material.clippingPlanes = enabled ? [plane] : [];
      if (changed) material.needsUpdate = true;
    }
    sync(); onPlane?.(); render(); onChange();
  };
  return {
    /** The plane while the model is cut open, as plain numbers; the cut keeps what is on the side the normal points to. */
    cut: () => enabled ? { normal: plane.normal.toArray(), constant: plane.constant } : undefined,
    snapshot: () => ({ sectionEnabled: enabled, sectionAxis: axis, sectionPosition: position, sectionFlipped: flipped, sectionRecommended: recommended?.label, sectionOnRecommended: onRecommended }),
    feature: {
      setEnabled(value) { enabled = value; apply(); },
      setAxis(value) { axis = value; onRecommended = false; apply(); },
      setPosition(value) { position = Math.max(0, Math.min(100, value)); apply(); },
      flip() { flipped = !flipped; apply(); },
      reset() { enabled = false; axis = 'z'; position = 50; flipped = true; onRecommended = false; apply(); },
      /** Switch to the step's recommended plane, if it named one, at the position it asks for. */
      useRecommended() { if (!recommended) return; onRecommended = true; position = Math.round(recommended.offset * 100); apply(); },
    },
    /**
     * A lesson step has begun: the cut starts off, and the step's recommended plane (if any) is the plane that comes up when the learner
     * turns it on. A step without one starts from the plane Explore starts from.
     * @param {{ label: string, normal: [number, number, number], offset?: number } | undefined} spec
     */
    startStep(spec) {
      enabled = false; flipped = true;
      recommended = spec ? { label: spec.label, normal: spec.normal, offset: spec.offset ?? 0.5 } : null;
      onRecommended = Boolean(recommended);
      axis = 'z';
      position = recommended ? Math.round(recommended.offset * 100) : 50;
      apply();
    },
    sync, refresh: apply,
    updateBounds(value) { bounds.copy(value); apply(); },
    dispose() {
      scene.remove(helpers);
      capGeometry.dispose();
      for (const { passes, cap } of entries) { for (const pass of passes) pass.material.dispose(); cap.material.dispose(); }
    },
  };
}
