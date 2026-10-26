import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createProceduralStudySampler, indexStudyParts } from '../src/viewer/core/animated-study-motion.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const registry = readJson('src/data/models.json');
const studies = registry.filter((model) => model.adapter === 'animated-study');

test('only the GTSIO-520-H R10 study turns or reframes its model; the other animated studies keep their own orientation', () => {
  assert.equal(studies.length, 7, 'seven animated-study models');
  for (const model of studies) {
    const contract = readJson(`web/${model.contractUrl.replace(/^\.\//, '').replace(/\?.*$/, '')}`);
    if (model.id === 'gtsio520-h-r10-mechanism-study') {
      // The default camera looks from the side of the odd cylinders and the alternator; a reflected export (procedural.mirror_x, docs/r10-handedness.md) mirrors that side.
      assert.deepEqual(contract.display, { rotation_x_deg: 90, fit_direction: [contract.procedural.mirror_x === true ? -1.3 : 1.3, 0.8, 1.55] });
    } else {
      assert.equal(contract.display, undefined, `${model.id} must not set a display orientation`);
    }
  }
});

test('the animated-study adapter reads orientation from the contract, with no model-specific constants', () => {
  const adapter = readFileSync(new URL('../src/viewer/adapters/animatedStudyAdapter.ts', import.meta.url), 'utf8');
  assert.ok(!/root\.rotation\.x\s*=\s*Math\.PI/.test(adapter), 'no hard-coded root rotation');
  assert.ok(!/Vector3\(\s*1\.3\s*,/.test(adapter), 'no hard-coded framing direction');
  assert.ok(/contract\.display/.test(adapter), 'orientation comes from contract.display');
});

function study(contractParts) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh();
  mesh.name = 'part-a';
  mesh.userData.partId = 'A';
  mesh.position.set(0.1, 0.2, 0.3);
  root.add(mesh);
  const { partsById } = indexStudyParts(root);
  return { root, mesh, partsById, contract: { parts: contractParts } };
}

test('building the procedural sampler leaves baked-clip models alone (their clips still move the parts)', () => {
  const { root, mesh, partsById, contract } = study([{ id: 'A' }]);
  const sampler = createProceduralStudySampler(contract, partsById, root);
  assert.equal(mesh.matrixAutoUpdate, true, 'the sampler must not freeze part matrices on construction');
  assert.equal(sampler.supports({ id: 'Operating mechanism' }), false);

  // A baked clip drives position; the matrix must follow it.
  mesh.position.set(1, 2, 3);
  root.updateMatrixWorld(true);
  assert.deepEqual(mesh.matrixWorld.elements.slice(12, 15), [1, 2, 3]);
});

test('the procedural sampler takes over part matrices on its first pose and works under a rotated root', () => {
  const { root, mesh, partsById, contract } = study([{ id: 'A', explosion: { stage: 1, offset_mm: [0, 0, 100] } }]);
  root.rotation.x = Math.PI / 2;
  const sampler = createProceduralStudySampler(contract, partsById, root);
  assert.equal(mesh.matrixAutoUpdate, true);

  sampler.apply({ id: 'Explode - illustrative layout' }, 100);
  assert.equal(mesh.matrixAutoUpdate, false);
  // CAD +z (up) is glTF +y inside the root; the root's quarter turn is applied above that.
  const lifted = new THREE.Vector3().setFromMatrixPosition(mesh.matrix);
  assert.ok(Math.abs(lifted.y - (0.2 + 0.1)) < 1e-9, `lifted y ${lifted.y}`);

  sampler.restoreRest();
  const rest = new THREE.Vector3().setFromMatrixPosition(mesh.matrix);
  assert.ok(rest.distanceTo(new THREE.Vector3(0.1, 0.2, 0.3)) < 1e-9);
});
