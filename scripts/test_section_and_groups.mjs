import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSectionController } from '../src/viewer/core/section-controller.mjs';
import { groupComponentIds } from '../src/viewer/core/component-groups.mjs';

const setup = geometry => {
  const scene = new THREE.Scene(), root = new THREE.Group();
  const part = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x379e9b }));
  root.add(part); scene.add(root); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const section = createSectionController([part], bounds, () => {}, () => {}, scene);
  return { scene, root, part, bounds, section, helpers: scene.children[1] };
};

test('section helpers track moving and morphing parts without changing model bounds', () => {
  const { part, root, bounds, section, helpers } = setup(new THREE.BoxGeometry(2, 2, 2));
  section.feature.setEnabled(true);
  const [back, front, cap] = helpers.children;
  assert.equal(back.material.stencilZPass, THREE.IncrementWrapStencilOp);
  assert.equal(front.material.stencilZPass, THREE.DecrementWrapStencilOp);
  assert.equal(cap.material.stencilFunc, THREE.NotEqualStencilFunc);
  assert.ok(back.renderOrder < cap.renderOrder);
  assert.equal(cap.material.color.getHex(), part.material.color.getHex());
  assert.deepEqual(new THREE.Box3().setFromObject(root), bounds);
  part.position.set(3, 1, 0); part.morphTargetInfluences = [0.6]; root.updateMatrixWorld(true); section.sync();
  assert.deepEqual(back.matrix.elements, part.matrixWorld.elements);
  assert.equal(front.morphTargetInfluences, part.morphTargetInfluences);
  section.feature.setAxis('x'); section.feature.setPosition(75);
  const plane = part.material.clippingPlanes[0];
  assert.ok(Math.abs(plane.distanceToPoint(cap.position)) < 1e-9);
  assert.equal(cap.position.x, 0.5);
  const normal = plane.normal.clone(); section.feature.flip();
  assert.equal(plane.normal.dot(normal), -1);
  part.visible = false; section.sync(); assert.ok(helpers.children.every(mesh => !mesh.visible));
  part.visible = true; part.material.opacity = 0.12; section.sync(); assert.ok(helpers.children.every(mesh => !mesh.visible));
  section.feature.reset(); assert.equal(helpers.visible, false); assert.deepEqual(part.material.clippingPlanes, []);
  let disposedSource = false; part.geometry.addEventListener('dispose', () => disposedSource = true);
  section.dispose(); assert.equal(disposedSource, false); assert.equal(helpers.parent, null);
});

test('opposite winding stencil passes preserve a genuine bore instead of filling it', () => {
  const shape = new THREE.Shape(); shape.absarc(0, 0, 2, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 1, 0, Math.PI * 2, true); shape.holes.push(hole);
  const { part, section, helpers } = setup(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false, curveSegments: 32 }));
  section.feature.setEnabled(true); helpers.updateMatrixWorld(true);
  // Count only the retained half, exactly as the clipped front/back passes do.
  const windingAt = x => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 0.123, 5), new THREE.Vector3(0, 0, -1));
    return helpers.children.slice(0, 2).reduce((sum, mesh, index) => sum + (index === 0 ? 1 : -1) * ray.intersectObject(mesh).filter(hit => part.material.clippingPlanes[0].distanceToPoint(hit.point) >= 0).length, 0);
  };
  assert.notEqual(windingAt(1.5), 0, 'solid wall receives a cap');
  assert.equal(windingAt(0), 0, 'bore remains open');
  assert.equal(windingAt(2.5), 0, 'outside stays empty');
  section.dispose();
});

test('subassembly isolation includes all members independently of the search result', () => {
  const components = [{ id: 'valve', group: 'intake' }, { id: 'pushrod', group: 'intake' }, { id: 'spring', group: 'intake' }, { id: 'exhaust', group: 'exhaust' }, { id: 'c1', group: 'cylinder-1' }, { id: 'c2', group: 'cylinder-2' }];
  assert.deepEqual(groupComponentIds(components, 'intake'), ['valve', 'pushrod', 'spring']);
  assert.deepEqual(groupComponentIds(components, 'cylinders'), ['c1', 'c2']);
  assert.deepEqual(groupComponentIds(components, 'missing'), []);
});
