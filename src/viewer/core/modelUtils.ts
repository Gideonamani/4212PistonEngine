import * as THREE from 'three';

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
