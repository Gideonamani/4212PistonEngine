import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { validateLessonPack } from '../web/schema/content-schema.mjs';
import { groupComponentIds } from '../src/viewer/core/component-groups.mjs';
import { createSectionController } from '../src/viewer/core/section-controller.mjs';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const contract = read('web/accessory-drives-contract.json');
const raw = gunzipSync(fs.readFileSync('web/accessory-drives.glb.gz'));
const { scene, animations } = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
const mixer = new THREE.AnimationMixer(scene);
const parts = new Map(); scene.traverse(mesh => { if (mesh.isMesh) parts.set(mesh.userData.cad_part_id, mesh); });
const sample = (name, fraction) => {
  mixer.stopAllAction(); const clip = animations.find(clip => clip.name === name);
  const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play(); action.paused = true; action.clampWhenFinished = true; action.time = clip.duration * fraction; mixer.update(0); scene.updateMatrixWorld(true);
};
test('source ledger, H endpoint ratios and all published lesson bindings agree', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), contract.asset_sha256);
  assert.equal(parts.size, contract.parts.length); assert.equal(animations.length, 10);
  for (const id of ['StarterAdapter', 'StarterCaseBushing', 'FuelGearShaft', 'FuelPumpInput', 'AlternatorBushing', 'TachDriveBevel', 'TachDrivenBevel', 'TachPadCover']) assert.ok(parts.has(id));
  assert.match(contract.parts.find(part => part.id === 'HousingCover').label, /Right crankcase/);
  assert.match(contract.parts.find(part => part.id === 'LeftMagneto').shape_status, /marker/);
  assert.deepEqual(validateLessonPack(read('web/accessories-lessons.json')), []);
  const pack = read('web/accessories-lessons.json'); assert.equal(pack.lessons[0].sequenceNumber, 8); assert.equal(pack.checks.length, 8);
  for (const step of pack.lessons[0].steps) {
    assert.ok(step.sourceRefs.every(ref => pack.sources.some(source => source.id === ref)));
    if (step.savedMotionId) assert.ok(animations.some(clip => clip.name === step.savedMotionId));
    for (const id of step.focusParts || []) assert.ok(parts.has(id));
  }
  const ratios = Object.fromEntries(contract.powerPaths.map(path => [path.id, path.ratio]));
  assert.deepEqual(ratios, { magnetos: 1.5, fuel: null, 'oil-tach': .5, starter: 32, alternator: 3, vacuum: 1.14, governor: .809 });
  assert.ok(contract.parts.every(part => part.volume_mm3 > 0 && part.evidence));
});
test('baked signed angular speeds survive glTF axis conversion without aliasing', () => {
  const checks = { CrankGear: 1, CamGear: -.5, IdlerGear: -1, LeftMagShaft: -1.5, RightMagShaft: -1.5, TachOutput: -.5, AlternatorOutput: -3, VacuumOutput: 1.14, GovernorOutput: -.809 };
  const dt = 1 / 600;
  sample('Operating mechanism', 0); const initial = new Map([...parts].map(([id, mesh]) => [id, mesh.quaternion.clone()]));
  sample('Operating mechanism', dt);
  for (const [id, rate] of Object.entries(checks)) {
    const delta = initial.get(id).clone().invert().multiply(parts.get(id).quaternion);
    const part = contract.parts.find(part => part.id === id);
    const axis = new THREE.Vector3(part.axis[0], part.axis[2], -part.axis[1]);
    const angle = 2 * Math.atan2(new THREE.Vector3(delta.x, delta.y, delta.z).dot(axis), delta.w);
    assert.ok(Math.abs(angle - 4 * Math.PI * dt * rate) < 2e-6, `${id}: ${angle}`);
  }
  sample('Starter engagement and start', 0); const zero = parts.get('StarterWorm').quaternion.clone();
  sample('Starter engagement and start', dt); const delta = zero.invert().multiply(parts.get('StarterWorm').quaternion);
  assert.ok(Math.abs(2 * Math.atan2(delta.x, delta.w) - 4 * Math.PI * dt * 32) < 2e-6, '32x starter samples must not alias');
});
test('starter releases and isolates complete overlapping paths at a held exploded pose', () => {
  sample('Starter engagement and start', .5); assert.ok(parts.get('ClutchSpring').scale.x < .98);
  sample('Starter engagement and start', .7); assert.ok(Math.abs(parts.get('ClutchSpring').scale.x - 1) < 1e-7);
  const worm = parts.get('StarterWorm').quaternion.clone(), shaft = parts.get('StarterShaftGear').quaternion.clone();
  sample('Starter engagement and start', .8);
  // glTF stores float32 quaternions; compare orientations after normalization,
  // so rounding of a constant quaternion cannot report a false rotation.
  assert.ok(worm.normalize().angleTo(parts.get('StarterWorm').quaternion.clone().normalize()) < 1e-5);
  assert.ok(shaft.normalize().angleTo(parts.get('StarterShaftGear').quaternion.clone().normalize()) > .1);
  sample('Exploded overview', .75); const held = [...parts.values()].map(mesh => mesh.matrixWorld.clone());
  const components = contract.parts.map(part => ({ ...part, groups: contract.powerPaths.filter(path => path.parts.includes(part.id)).map(path => `path:${path.id}`) }));
  for (const path of contract.powerPaths) assert.deepEqual(groupComponentIds(components, `path:${path.id}`).sort(), [...path.parts].sort());
  [...parts.values()].forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, held[index].elements));
  mixer.stopAllAction();
});
test('published FreeCAD pump pockets stay empty in a coloured section cut', () => {
  sample('Operating mechanism', 0);
  const pump = parts.get('OilHousing'), bounds = new THREE.Box3().setFromObject(pump);
  const section = createSectionController([pump], bounds, () => {}, () => {}, scene);
  section.feature.setAxis('y'); section.feature.setPosition(50); section.feature.setEnabled(true);
  const helpers = scene.getObjectByName('Section cut faces'); helpers.updateMatrixWorld(true);
  const winding = (x, z) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
    return helpers.children.slice(0, 2).reduce((sum, mesh, i) => sum + (i === 0 ? 1 : -1) * ray.intersectObject(mesh).filter(hit => pump.material.clippingPlanes[0].distanceToPoint(hit.point) >= 0).length, 0);
  };
  assert.equal(winding(.008, .09), 0, 'empty gear pocket stays empty above its floor');
  assert.notEqual(winding(-.043, .09), 0, 'solid side wall receives a cap');
  assert.equal(helpers.children[2].material.color.getHex(), pump.material.color.getHex());
  section.dispose(); mixer.stopAllAction();
});

test('assembled mount/shaft audits match the export and teaching stands carry no torque', () => {
  const audit = read('cad-studies/accessory-drives/cad-verification.json');
  assert.equal(audit.scope, contract.scope);
  assert.equal(audit.assembled_interfaces.length, contract.interfaces.length);
  assert.ok(audit.assembled_interfaces.length > 50);
  for (const joint of audit.assembled_interfaces) assert.ok(joint.distance_mm <= joint.max_gap_mm + .005, `${joint.a} / ${joint.b}`);
  for (const pair of audit.interference_checks) assert.ok(pair.overlap_mm3 < 1e-4, `${pair.a} / ${pair.b}`);
  const fixtures = contract.parts.filter(part => part.role === 'teaching-fixture');
  assert.equal(fixtures.length, 3);
  assert.deepEqual(contract.remoteDisplays.map(display => display.group).sort(), fixtures.map(part => part.group).sort());
  const torqueIds = new Set(contract.powerPaths.flatMap(path => path.edges.flat()));
  sample('Operating mechanism', 0);
  const initial = fixtures.map(part => parts.get(part.id).matrixWorld.clone());
  for (const clip of animations) {
    sample(clip.name, 1);
    fixtures.forEach((part, index) => {
      assert.ok(!torqueIds.has(part.id));
      assert.deepEqual(parts.get(part.id).matrixWorld.elements, initial[index].elements, 'display support remains fixed');
    });
  }
  const tach = contract.rotationOutputs.find(output => output.id === 'TachOutput');
  assert.deepEqual(tach.axis, [-1, 0, 0]);
  assert.deepEqual(contract.rotationOutputs.find(output => output.id === 'LeftMagShaft').axis, [0, -1, 0]);
  assert.ok(contract.powerPaths.find(path => path.id === 'oil-tach').edges.some(([a,b]) => a === 'TachDriveBevel' && b === 'TachDrivenBevel'));
  mixer.stopAllAction();
});

test('the tach pitch cones roll together and front magnetos share their gear rotation', () => {
  const velocity = (id, contact) => {
    const part = contract.parts.find(part => part.id === id);
    return new THREE.Vector3(...part.axis).multiplyScalar(part.rate)
      .cross(new THREE.Vector3(...contact).sub(new THREE.Vector3(...part.pivot_mm)));
  };
  const contact = [-9, -90, 76];
  assert.ok(velocity('TachDriveBevel', contact).distanceTo(velocity('TachDrivenBevel', contact)) < 1e-9,
    'pitch-contact tangential velocities agree despite the 90-degree shaft axes');
  for (const side of ['Left', 'Right']) {
    const gear = contract.parts.find(part => part.id === `${side}MagGear`);
    const shaft = contract.parts.find(part => part.id === `${side}MagShaft`);
    assert.ok(new THREE.Vector3(...gear.axis).multiplyScalar(gear.rate)
      .distanceTo(new THREE.Vector3(...shaft.axis).multiplyScalar(shaft.rate)) < 1e-9);
  }
});
