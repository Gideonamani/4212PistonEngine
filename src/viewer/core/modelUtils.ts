import * as THREE from 'three';
import type { PartBox, ViewerRuntime } from '../types';

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

/**
 * The box each part occupies in world space: the union of the boxes of the meshes that belong to it. A part with no geometry is left out.
 * Boxes follow the model's pose when they are asked for, so the viewer answers them at the pose it opened in.
 */
export function partBoxes(owned: Iterable<[string, THREE.Object3D]>): PartBox[] {
  const boxes = new Map<string, THREE.Box3>();
  for (const [id, object] of owned) {
    object.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) continue;
    const known = boxes.get(id);
    if (known) known.union(box); else boxes.set(id, box);
  }
  return [...boxes].map(([id, box]) => ({ id, min: box.min.toArray() as PartBox['min'], max: box.max.toArray() as PartBox['max'] }));
}

/**
 * Moves the camera to look at these objects, leaving what is drawn and the view Reset returns to alone. It never comes closer than a fifth
 * of the whole model, so a small part keeps some of the model around it to place it by.
 */
export function frameObjects(runtime: ViewerRuntime, objects: THREE.Object3D[], whole: THREE.Object3D, padding = 1.4) {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const wholeSphere = new THREE.Box3().setFromObject(whole).getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, wholeSphere.radius * 0.2);
  runtime.focus(sphere.center, radius / Math.sin(THREE.MathUtils.degToRad(runtime.camera.fov) / 2) * padding);
}

export { createSectionController } from './section-controller.mjs';

export function cloneMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clones = originals.map((material) => material.clone());
    mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
  });
}
