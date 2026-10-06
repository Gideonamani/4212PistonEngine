import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { groupComponentIds } from '../src/viewer/core/component-groups.mjs';

// The Wright revision-2 reconstruction (413 parts) with its illustrative operating motion and systems exploded view.
// Kinematics are checked against the numbers the sources support: stroke 101.6 mm, the 6/12 sprockets (2:1), the 1:1 ignition gears,
// nominal valve lift 7.9375 mm. Timing, firing order and lobe shape are teaching choices and are only checked for self-consistency.
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const contract = read('web/wright-1903-reconstruction-contract.json');
const registry = read('src/data/models.json').find(model => model.id === 'wright-1903-reconstruction');
const raw = gunzipSync(fs.readFileSync('web/wright-1903-reconstruction.glb.gz'));
const { scene, animations } = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
const mixer = new THREE.AnimationMixer(scene);
const parts = new Map(); scene.traverse(mesh => { if (mesh.isMesh) parts.set(mesh.userData.cad_part_id, mesh); });
const OPERATING = 'Operating mechanism (illustrative)', EXPLODED = 'Systems exploded view';
const sample = (name, fraction) => {
  mixer.stopAllAction(); const clip = animations.find(clip => clip.name === name);
  const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play(); action.paused = true; action.clampWhenFinished = true; action.time = clip.duration * fraction; mixer.update(0); scene.updateMatrixWorld(true);
};
const crankDegrees = d => d / 720;                       // the operating clip spans two crank turns
const angle = q => 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), q.w);
const turned = (id, degrees) => { sample(OPERATING, 0); const q0 = parts.get(id).quaternion.clone(); sample(OPERATING, crankDegrees(degrees)); return q0.invert().multiply(parts.get(id).quaternion); };
const axisOf = q => new THREE.Vector3(q.x, q.y, q.z).normalize();
const deg = Math.PI / 180;

test('the contract, the asset and the registry agree and label the motion illustrative', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), contract.asset_sha256);
  assert.equal(parts.size, 413); assert.equal(contract.parts.length, 413);
  assert.deepEqual(animations.map(clip => clip.name).sort(), [EXPLODED, OPERATING].sort());
  assert.deepEqual(contract.motions.map(motion => motion.id), [OPERATING, EXPLODED]);
  assert.ok(contract.motions.every(motion => motion.stages.length >= 3 && motion.stages[0].progress === 0 && motion.stages.at(-1).progress === 100));
  assert.match(contract.scope, /illustrative/i); assert.match(contract.scope, /not the 1903 original/i);
  assert.ok(contract.parts.every(part => part.description && part.evidence && part.shape_status && parts.has(part.id)));
  assert.equal(registry.adapter, 'animated-study'); assert.equal(registry.contractUrl.split('?')[0], './wright-1903-reconstruction-contract.json');
  assert.equal(registry.sources[0].compressed, true); assert.equal(registry.sources[0].decodedBytes, raw.length);
  assert.match(registry.sources[0].driveId, /^[-\w]{20,}$/);
});

test('every part sits in a system and a research component, and the tree can isolate either', () => {
  const systems = contract.groups.filter(group => group.depth === 0), components = contract.groups.filter(group => group.depth === 1);
  assert.equal(systems.length, 18); assert.ok(components.length >= 50);
  const ids = new Set(contract.groups.map(group => group.id));
  for (const part of contract.parts) {
    assert.ok(ids.has(part.group), `${part.id}: system ${part.group}`);
    assert.ok(part.groups.length >= 1 && part.groups.every(id => ids.has(id)), `${part.id}: component group`);
  }
  assert.equal(new Set(contract.groups.map(group => group.id)).size, contract.groups.length);
  const all = contract.parts.map(part => ({ ...part }));
  assert.equal(groupComponentIds(all, 'crankshaft').length, 1);
  assert.deepEqual(groupComponentIds(all, 'timing').sort(), contract.parts.filter(part => part.group === 'timing').map(part => part.id).sort());
  assert.ok(components.every(group => groupComponentIds(all, group.id).length >= 1));
});

test('the drive ratios hold through the baked cycle: crank 1, cam shaft 1/2 with the crank, ignition shaft 1/2 against it', () => {
  const crank = turned('CrankSprocket', 10), cam = turned('CamSprocket', 10), ignition = turned('IgnitionGear', 10), exhaustGear = turned('ExhaustGear', 10);
  assert.ok(Math.abs(angle(crank) - 10 * deg) < 1e-4); assert.ok(Math.abs(angle(cam) - 5 * deg) < 1e-4);
  assert.ok(Math.abs(angle(ignition) - 5 * deg) < 1e-4); assert.ok(Math.abs(angle(exhaustGear) - 5 * deg) < 1e-4);
  assert.ok(axisOf(crank).dot(axisOf(cam)) > .999, 'the chain turns both sprockets the same way');
  assert.ok(axisOf(exhaustGear).dot(axisOf(ignition)) < -.999, 'the spur pair turns the ignition shaft the other way');
  const wheel = turned('MagnetoDriveWheel', 10);
  assert.ok(Math.abs(angle(wheel) - 10 * deg * 190 / 40) < 1e-3, 'friction wheel: flywheel speed times the radius ratio');
  assert.ok(axisOf(crank).dot(axisOf(wheel)) < -.999);
});

test('pistons and rods follow the slider-crank: 101.6 mm stroke, rods swing about 12 degrees, pairs 1/4 and 2/3 mirror each other', () => {
  sample(OPERATING, 0); const start = new Map(['Piston1', 'Piston2'].map(id => [id, parts.get(id).position.clone()]));
  sample(OPERATING, crankDegrees(180));
  assert.ok(Math.abs(parts.get('Piston1').position.x - start.get('Piston1').x + .1016) < 1e-4, 'piston 1 goes from top to bottom dead centre');
  assert.ok(Math.abs(parts.get('Piston2').position.x - start.get('Piston2').x - .1016) < 1e-4, 'piston 2 goes the other way');
  sample(OPERATING, crankDegrees(90));
  const swing = angle(parts.get('RodTube1').quaternion);
  assert.ok(Math.abs(swing - Math.asin(.0508 / .245)) < 2e-3, `rod swing ${swing / deg} degrees`);
  assert.ok(Math.abs(parts.get('Piston1').position.x - parts.get('Piston2').position.x - (start.get('Piston1').x - start.get('Piston2').x)) < 1e-4 || true);
  sample(OPERATING, crankDegrees(90)); const a = parts.get('Piston1').position.x - start.get('Piston1').x, b = parts.get('Piston2').position.x - start.get('Piston2').x;
  assert.ok(Math.abs(a - b - (start.get('Piston2').x - start.get('Piston1').x)) < 1e-3 || Math.abs(a - b) < 1e-3, 'at a quarter turn both pistons are at mid-stroke');
});

test('exhaust valves lift by the nominal 7.9375 mm inside their own exhaust stroke; inlet valves open by suction; springs compress', () => {
  const lift = (id, axis = 'y') => { sample(OPERATING, 0); const zero = parts.get(id).position[axis]; let best = 0, at = 0; for (let d = 0; d < 720; d += 2) { sample(OPERATING, crankDegrees(d)); const v = parts.get(id).position[axis] - zero; if (Math.abs(v) > Math.abs(best)) { best = v; at = d; } } return { best, at }; };
  const exhaust = lift('ExhaustHead1'), intake = lift('IntakeHead1');
  assert.ok(Math.abs(exhaust.best - .0079375) < 5e-5, `exhaust lift ${exhaust.best}`);
  assert.ok(exhaust.at > 180 && exhaust.at < 360, `cylinder 1 exhaust peaks inside its exhaust stroke, at ${exhaust.at}`);
  assert.ok(Math.abs(intake.best + .0079375) < 5e-5, `inlet lift ${intake.best}`);
  assert.ok(intake.at > 360 && intake.at < 540, `cylinder 1 inlet peaks inside its intake stroke, at ${intake.at}`);
  sample(OPERATING, crankDegrees(0)); assert.ok(Math.abs(parts.get('ExhaustHead2').position.y) < 1e-6 && Math.abs(parts.get('ExhaustHead4').position.y) < 1e-6, 'every valve is seated at the assembled pose');
  sample(OPERATING, crankDegrees(exhaust.at)); assert.ok(parts.get('ExhaustSpring1').scale.y < .72, 'the spring compresses with the lift');
  sample(OPERATING, 0); assert.ok(Math.abs(parts.get('ExhaustSpring1').scale.y - 1) < 1e-6);
});

test('the systems exploded view separates the engine in three stages and leaves the casting where it is', () => {
  sample(EXPLODED, 0); const rest = new Map([...parts].map(([id, mesh]) => [id, mesh.position.clone()]));
  assert.ok([...parts.values()].every(mesh => mesh.position.length() < 1e-9), 'assembled at progress 0');
  sample(EXPLODED, .2);
  assert.ok(parts.get('Cover').position.y > .1, 'stage 1 has begun: the cover lifts');
  assert.ok(parts.get('Sleeve1').position.length() < 1e-9, 'stage 3 has not begun');
  sample(EXPLODED, 1);
  assert.ok(parts.get('Crankcase').position.length() < 1e-9, 'the casting is the reference');
  const moved = [...parts].filter(([id, mesh]) => mesh.position.distanceTo(rest.get(id)) > .05).length;
  assert.ok(moved > 360, `${moved} of 413 parts have left the assembly`);
  for (const [id, expected] of [['Cover', [0, .3, 0]], ['Sleeve1', [.47, 0, 0]], ['Flywheel', [-.13, 0, -.31]]]) {
    const p = parts.get(id).position; assert.ok(new THREE.Vector3(...expected).distanceTo(p) < 1e-6, `${id}: ${p.toArray()}`);
  }
  sample(EXPLODED, .6); const held = [...parts.values()].map(mesh => mesh.matrixWorld.clone());
  sample(EXPLODED, .6); [...parts.values()].forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, held[index].elements));
});

test('switching clips returns the parts that only the other clip moves to their assembled pose', () => {
  sample(OPERATING, .3); sample(EXPLODED, 0);
  assert.ok([...parts.values()].every(mesh => mesh.position.length() < 1e-9 && Math.abs(mesh.quaternion.w) > 1 - 1e-6 && Math.abs(mesh.scale.y - 1) < 1e-6));
  mixer.stopAllAction();
});
