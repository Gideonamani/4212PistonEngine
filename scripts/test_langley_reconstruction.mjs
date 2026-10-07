import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { groupComponentIds } from '../src/viewer/core/component-groups.mjs';

// The Langley / Manly-Balzer reconstruction (358 parts) with its illustrative operating motion and systems exploded view.
// Kinematics are checked against what the sources support: stroke 139.7 mm, the cam at -1/4 crank speed through three meshes, the ignition gears at 2.5x and 0.5x
// (reverse), the 1/64 in punch-rod gap. Timing, lobe shape and valve lift are teaching choices and are only checked for self-consistency.
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const contract = read('web/langley-manly-balzer-1903-contract.json');
const registry = read('src/data/models.json').find(model => model.id === 'langley-manly-balzer-1903');
const raw = gunzipSync(fs.readFileSync('web/langley-manly-balzer-1903.glb.gz'));
const { scene, animations } = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
const mixer = new THREE.AnimationMixer(scene);
const parts = new Map(); scene.traverse(mesh => { if (mesh.isMesh) parts.set(mesh.userData.cad_part_id, mesh); });
const rest = new Map([...parts].map(([id, mesh]) => [id, mesh.position.clone()]));      // the node origin: on the axis for a part that turns about a fixed axis
const restQuaternion = new Map([...parts].map(([id, mesh]) => [id, mesh.quaternion.clone()]));   // a spring is stored in its own frame, so its node carries a rest rotation
const displacement = id => parts.get(id).position.clone().sub(rest.get(id));
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
// CAD (x, y, z) -> glTF (x, z, -y): the shaft is along x, cylinder k points along CAD (0, -sin a_k, cos a_k) = glTF (0, cos a_k, sin a_k) with a_k = 72 (k-1) degrees.
const R = .06985, L = .288, POWER_TDC = { 1: 360, 3: 504, 5: 648, 2: 72, 4: 216 };
const REST_LIFT = { 1: .0014425, 3: .0072211 };           // exhaust valves already open at the assembled pose (cylinder 1 closing, cylinder 3 mid-exhaust); the others are shut
const alpha = k => 72 * (k - 1) * deg;
const slider = (k, theta) => { const psi = theta * deg - alpha(k); return R * Math.cos(psi) + Math.sqrt(L * L - (R * Math.sin(psi)) ** 2); };

test('the contract, the asset and the registry agree and label the motion illustrative', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), contract.asset_sha256);
  assert.equal(parts.size, 358); assert.equal(contract.parts.length, 358);
  assert.deepEqual(animations.map(clip => clip.name).sort(), [EXPLODED, OPERATING].sort());
  assert.deepEqual(contract.motions.map(motion => motion.id), [OPERATING, EXPLODED]);
  assert.ok(contract.motions.every(motion => motion.stages.length >= 4 && motion.stages[0].progress === 0 && motion.stages.at(-1).progress === 100 && motion.stages.every((stage, i, all) => !i || stage.progress > all[i - 1].progress)));
  assert.match(contract.scope, /illustrative/i); assert.match(contract.scope, /not the museum object/i);
  assert.ok(contract.parts.every(part => part.description && part.evidence && part.shape_status && parts.has(part.id)));
  assert.equal(registry.adapter, 'animated-study'); assert.equal(registry.contractUrl.split('?')[0], './langley-manly-balzer-1903-contract.json');
  assert.equal(registry.sources[0].compressed, true); assert.equal(registry.sources[0].decodedBytes, raw.length);
  assert.match(registry.sources[0].driveId, /^[-\w]{20,}$/);
  assert.equal(contract.gearMeshes.length, 5);
});

test('every part sits in a system and a research component, and the tree can isolate either', () => {
  const systems = contract.groups.filter(group => group.depth === 0), components = contract.groups.filter(group => group.depth === 1);
  assert.equal(systems.length, 12); assert.ok(components.length >= 30);
  const ids = new Set(contract.groups.map(group => group.id));
  for (const part of contract.parts) {
    assert.ok(ids.has(part.group), `${part.id}: system ${part.group}`);
    assert.ok(part.groups.length >= 1 && part.groups.every(id => ids.has(id)), `${part.id}: component group`);
  }
  assert.equal(new Set(contract.groups.map(group => group.id)).size, contract.groups.length);
  const all = contract.parts.map(part => ({ ...part }));
  assert.equal(groupComponentIds(all, 'crank').length, 3);
  assert.deepEqual(groupComponentIds(all, 'timing').sort(), contract.parts.filter(part => part.group === 'timing').map(part => part.id).sort());
  assert.ok(components.every(group => groupComponentIds(all, group.id).length >= 1));
});

test('the drive ratios hold through the baked cycle: cam -1/4, ignition gears 0.5 against and 2.5 with the crank', () => {
  const crank = turned('Crankshaft', 10), cam = turned('CamRing', 10), large = turned('CamGearLarge', 10), small = turned('CamGearSmall', 10), idler = turned('CamIdler', 10);
  assert.ok(Math.abs(angle(crank) - 10 * deg) < 1e-4);
  assert.ok(Math.abs(angle(cam) - 2.5 * deg) < 1e-4 && axisOf(crank).dot(axisOf(cam)) < -.999, 'the cam turns a quarter as fast, the other way');
  assert.ok(Math.abs(angle(large) - 5 * deg) < 1e-4 && axisOf(crank).dot(axisOf(large)) < -.999, 'pinion 24 to gear 48');
  assert.ok(Math.abs(angle(small) - 5 * deg) < 1e-4, 'the small gear shares the large gear\'s axle');
  assert.ok(Math.abs(angle(idler) - 4.5 * deg) < 1e-4 && axisOf(crank).dot(axisOf(idler)) > .999, 'small gear 18 to idler 20: the idler turns 0.9 times the large gear, the other way');
  const ignition = turned('SparkGearLarge', 10), brush = turned('DistributorBrush', 10), sparker = turned('SparkerCam', 10), sleeve = turned('SparkSleeve', 10);
  assert.ok(Math.abs(angle(sleeve) - 10 * deg) < 1e-4, 'the ignition sleeve is fixed to the crankshaft');
  assert.ok(Math.abs(angle(ignition) - 5 * deg) < 1e-4 && axisOf(crank).dot(axisOf(ignition)) < -.999, 'distributor gear at 0.5x, reversed');
  assert.ok(Math.abs(angle(brush) - 5 * deg) < 1e-4);
  assert.ok(Math.abs(angle(sparker) - 25 * deg) < 1e-4 && axisOf(crank).dot(axisOf(sparker)) > .999, 'sparker cam at 2.5x with the crank');
  for (const id of ['FlywheelRimPort', 'FlywheelHubStbd', 'CamPinion', 'WormWheel']) assert.ok(Math.abs(angle(turned(id, 10)) - 10 * deg) < 1e-4, `${id} turns with the crank`);
  for (const id of ['PortDrum', 'StartWorm', 'PumpShaftUpper', 'CamStud']) assert.ok(angle(turned(id, 10)) < 1e-9, `${id} stays put`);
});

test('pistons and rods follow the slider-crank: 139.7 mm stroke, rods swing about 14 degrees, the five strokes are identical', () => {
  sample(OPERATING, 0); const start = new Map([1, 2, 3, 4, 5].map(k => [k, parts.get(`Piston${k}`).position.clone()]));
  const travel = (k, degrees) => { sample(OPERATING, crankDegrees(degrees)); return parts.get(`Piston${k}`).position.clone().sub(start.get(k)); };
  for (const k of [1, 2, 3, 4, 5]) {
    for (const d of [37, 90, 251, 480, 600]) {
      const expected = slider(k, d) - slider(k, 0), direction = new THREE.Vector3(0, Math.cos(alpha(k)), Math.sin(alpha(k)));
      assert.ok(travel(k, d).distanceTo(direction.multiplyScalar(expected)) < 1e-5, `piston ${k} at ${d} degrees`);
    }
  }
  assert.ok(Math.abs(slider(1, 180) - slider(1, 0) + 2 * R) < 1e-9 && Math.abs(2 * R - .1397) < 1e-6, 'a stroke of 5.5 in');
  assert.ok(Math.abs(travel(1, 180).y + .1397) < 1e-5, 'piston 1 goes from top to bottom dead centre');
  sample(OPERATING, crankDegrees(90));
  const swing = angle(parts.get('MasterRod').quaternion);
  assert.ok(Math.abs(swing - Math.asin(R / L)) < 1e-3 && swing / deg > 13.5 && swing / deg < 14.5, `master rod swing ${swing / deg} degrees`);
  for (const k of [2, 3, 4, 5]) assert.ok(parts.get(`LinkRod${k}`).quaternion.angleTo(new THREE.Quaternion()) > 0, `link rod ${k} swings`);
});

test('exhaust valves lift 12 mm inside their own exhaust stroke, inlet valves open by suction in their intake stroke, springs follow', () => {
  const lift = (id, k, sign) => { let best = 0, at = 0; sample(OPERATING, 0); const zero = parts.get(id).position.clone(); const direction = new THREE.Vector3(0, Math.cos(alpha(k)), Math.sin(alpha(k)));
    for (let d = 0; d < 720; d += 2) { sample(OPERATING, crankDegrees(d)); const v = sign * parts.get(id).position.clone().sub(zero).dot(direction); if (v > best) { best = v; at = d; } } return { best: sign * best, at }; };
  for (const k of [1, 2, 3, 4, 5]) {
    const exhaust = lift(`ExhaustValve${k}`, k, 1), intake = lift(`InletValve${k}`, k, -1), t = POWER_TDC[k], inside = (d, lo, hi) => ((d - t - lo + 1440) % 720) < hi - lo;
    assert.ok(Math.abs(exhaust.best - (.012 - (REST_LIFT[k] ?? 0))) < 1e-4, `cylinder ${k} exhaust lift ${exhaust.best} from the assembled pose, 12 mm at the peak`);
    assert.ok(inside(exhaust.at, 180, 360), `cylinder ${k} exhaust peaks at ${exhaust.at}, inside its exhaust stroke`);
    assert.ok(Math.abs(intake.best + .006) < 1e-4, `cylinder ${k} inlet lift ${intake.best}`);
    assert.ok(inside(intake.at, 360, 540), `cylinder ${k} inlet peaks at ${intake.at}, inside its intake stroke`);
  }
  sample(OPERATING, 0);
  for (const k of [2, 4, 5]) assert.ok(displacement(`ExhaustValve${k}`).length() < 1e-9, `exhaust valve ${k} is shut at the assembled pose`);
  assert.ok(displacement('InletValve1').length() < 1e-9);
  sample(OPERATING, crankDegrees(630)); assert.ok(Math.abs(parts.get('ExhaustSpring1').scale.y - .7247) < 2e-3, `spring scale ${parts.get('ExhaustSpring1').scale.y}`);
  sample(OPERATING, 0); assert.ok(Math.abs(parts.get('ExhaustSpring1').scale.y - 1) < 1e-6);
  const moved = (id, d) => { sample(OPERATING, 0); const a = parts.get(id).position.clone(); sample(OPERATING, crankDegrees(d)); return parts.get(id).position.clone().sub(a); };
  assert.ok(moved('PunchRod1', 630).distanceTo(moved('ExhaustValve1', 630)) < 1e-6, 'the punch rod and the exhaust stem move together once the 0.397 mm gap is taken up');
  assert.ok(Math.abs(moved('PunchRod2', 342).distanceTo(moved('ExhaustValve2', 342)) - .000397) < 1e-6, 'a shut valve: the rod has to rise the whole 0.397 mm gap before the stem moves');
});

test('the sparker pawl is pressed down only when a lobe passes, and the spring stretches with it', () => {
  sample(OPERATING, 0); assert.ok(displacement('SparkerPawl').length() < 1e-9);
  let deepest = 0; for (let d = 0; d < 720; d += 1) { sample(OPERATING, crankDegrees(d)); deepest = Math.min(deepest, displacement('SparkerPawl').y); }
  assert.ok(deepest < -.004 && deepest > -.0065, `deepest press ${deepest}`);
});

test('the systems exploded view separates the engine in three stages and leaves the crankshaft with the rods where they are', () => {
  sample(EXPLODED, 0);
  assert.ok([...parts.keys()].every(id => displacement(id).length() < 1e-9), 'assembled at progress 0');
  sample(EXPLODED, .2);
  assert.ok(new THREE.Vector3(-.252, 0, 0).distanceTo(displacement('InletRingA')) < 1e-6, 'stage 1 has begun: the inlet ring leaves along the shaft');
  assert.ok(displacement('CylShell1').length() < 1e-9, 'stage 3 has not begun');
  sample(EXPLODED, 1);
  for (const id of ['Crankshaft', 'MasterRod', 'LinkRod3', 'MasterSleeveCap']) assert.ok(displacement(id).length() < 1e-9, `${id} is the reference`);
  const moved = [...parts.keys()].filter(id => displacement(id).length() > .05).length;
  assert.ok(moved > 300, `${moved} of 358 parts have left the assembly`);
  for (const [id, expected] of [['InletRingA', [-.42, 0, 0]], ['CylShell1', [0, .33, 0]], ['CylShell2', [0, .33 * Math.cos(72 * deg), .33 * Math.sin(72 * deg)]], ['FlywheelRimPort', [-.52, 0, 0]], ['FlywheelRimStbd', [.52, 0, 0]], ['WaterInletRing', [.3, 0, 0]]]) {
    const p = displacement(id); assert.ok(new THREE.Vector3(...expected).distanceTo(p) < 1e-6, `${id}: ${p.toArray()}`);
  }
  sample(EXPLODED, .6); const held = [...parts.values()].map(mesh => mesh.matrixWorld.clone());
  sample(EXPLODED, .6); [...parts.values()].forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, held[index].elements));
});

test('a part that turns about a fixed axis has its origin on the axis, so interpolating between keys cannot move the axis', () => {
  const axes = { Crankshaft: [0, 0], CamRing: [0, 0], CamGearLarge: [-.031576144, .103280914], CamIdler: [-.062908189, .055664709], SparkGearLarge: [.1125, 0], SparkerCam: [.2025, 0] };     // CAD y, z in metres
  for (const [id, [y, z]] of Object.entries(axes)) {
    // glTF is y-up: CAD (x, y, z) -> (x, z, -y); the axis is parallel to the CAD x direction
    assert.ok(Math.abs(rest.get(id).y - z) < 1e-6 && Math.abs(rest.get(id).z + y) < 1e-6 && Math.abs(rest.get(id).x) < 1e-9, `${id} origin ${rest.get(id).toArray()}`);
    for (const d of [0, 7, 100, 333, 719]) { sample(OPERATING, crankDegrees(d)); assert.ok(displacement(id).length() < 1e-7, `${id} drifts at ${d} degrees`); }
  }
});

test('switching clips returns the parts that only the other clip moves to their assembled pose', () => {
  sample(OPERATING, .3); sample(EXPLODED, 0);
  assert.ok([...parts.keys()].every(id => displacement(id).length() < 1e-9 && parts.get(id).quaternion.angleTo(restQuaternion.get(id)) < 1e-6 && Math.abs(parts.get(id).scale.y - 1) < 1e-6));
  mixer.stopAllAction();
});
