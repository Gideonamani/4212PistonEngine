import * as THREE from 'three';
import type { SectionAxis } from '../types';

export function disposeObject(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const entries = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of entries) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

export function meshMaterials(mesh: THREE.Mesh) {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean) as THREE.Material[];
}

export function createSectionController(meshes: THREE.Mesh[], bounds: THREE.Box3, render: () => void, onChange: () => void) {
  const plane = new THREE.Plane();
  let enabled = false;
  let axis: SectionAxis = 'z';
  let position = 50;
  let flipped = true;

  const apply = () => {
    const point = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    point[axis] += size[axis] * 0.5 * (position - 50) / 50;
    const normal = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    if (flipped) normal.negate();
    plane.setFromNormalAndCoplanarPoint(normal, point);
    for (const mesh of meshes) {
      for (const material of meshMaterials(mesh)) {
        material.clippingPlanes = enabled ? [plane] : [];
        material.needsUpdate = true;
      }
    }
    render();
    onChange();
  };

  return {
    snapshot: () => ({ sectionEnabled: enabled, sectionAxis: axis, sectionPosition: position, sectionFlipped: flipped }),
    feature: {
      setEnabled(value: boolean) { enabled = value; apply(); },
      setAxis(value: SectionAxis) { axis = value; apply(); },
      setPosition(value: number) { position = value; apply(); },
      flip() { flipped = !flipped; apply(); },
      reset() { enabled = false; axis = 'z'; position = 50; flipped = true; apply(); },
    },
    refresh: apply,
  };
}

export function cloneMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clones = originals.map((material) => material.clone());
    mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
  });
}
