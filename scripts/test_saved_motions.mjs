import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createExplodedMotion, explosionAmount } from '../src/viewer/core/saved-motions.mjs';
import { rolldown } from 'rolldown';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const profile = read('web/cylinder-saved-motions.json');
const parse = async file => { const bytes = gunzipSync(fs.readFileSync(file)); return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''); };

test('staged explosion preserves permanent joints, reverses and restores every bind matrix', async () => {
  const { scene } = await parse('web/cylinder-reviewed-20261001.glb.gz'); scene.updateMatrixWorld(true);
  const meshes = []; scene.traverse(mesh => { if (mesh.isMesh) { mesh.userData.partId = mesh.userData.cad_part_id; meshes.push(mesh); } });
  const binds = new Map(meshes.map(mesh => [mesh.userData.partId, mesh.matrixWorld.clone()]));
  const motion = createExplodedMotion(meshes, profile);
  const native = read('cad-studies/cylinder/native-motion-samples.json').samples;
  for (const progress of [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100]) {
    motion.apply(progress); scene.updateMatrixWorld(true);
    for (const mesh of meshes) {
      assert.ok(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).distanceTo(new THREE.Vector3(...native['Exploded overview'][progress][mesh.userData.partId])) < .000002, mesh.userData.partId + ' native Blender pose');
      const entry = profile.parts[mesh.userData.partId];
      const delta = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(binds.get(mesh.userData.partId)));
      assert.ok(delta.distanceTo(new THREE.Vector3(...entry.offset_m).multiplyScalar(explosionAmount(progress, entry.stage, 4))) < 1e-8);
    }
    const exploded = meshes.map(mesh => mesh.matrixWorld.clone()); motion.apply(100 - progress, true); scene.updateMatrixWorld(true);
    meshes.forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, exploded[index].elements));
  }
  assert.deepEqual(profile.parts.CylinderHead.offset_m, profile.parts.CylinderBarrel.offset_m);
  for (const id of ['IntakeValveGuide', 'ExhaustValveGuide', 'IntakeSeatInsert', 'ExhaustSeatInsert']) assert.deepEqual(profile.parts[id].offset_m, profile.parts.CylinderHead.offset_m);
  motion.apply(0); scene.updateMatrixWorld(true);
  for (const mesh of meshes) assert.deepEqual(mesh.matrixWorld.elements, binds.get(mesh.userData.partId).elements);
});

for (const id of ['hydraulic-tappet', 'oil-pump', 'accessory-drives']) test(`${id} exported clips preserve component identity and reverse exploded poses`, async () => {
  const contract = read(`web/${id}-contract.json`), raw = gunzipSync(fs.readFileSync(`web/${id}.glb.gz`));
  assert.equal(createHash('sha256').update(raw).digest('hex'), contract.asset_sha256);
  const { scene, animations } = await parse(`web/${id}.glb.gz`); scene.updateMatrixWorld(true);
  assert.deepEqual(animations.map(clip => clip.name).sort(), contract.motions.map(motion => motion.id).sort());
  const meshes = []; scene.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
  assert.deepEqual(meshes.map(mesh => mesh.userData.cad_part_id).sort(), contract.parts.map(part => part.id).sort());
  const bases = meshes.map(mesh => mesh.matrixWorld.clone()), mixer = new THREE.AnimationMixer(scene);
  if (id === 'hydraulic-tappet') {
    const clip = animations.find(clip => clip.name === 'Operating mechanism');
    for (const [progress, opening] of [[.25, 0], [.75, .0003]]) {
      mixer.stopAllAction(); const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play(); action.paused = true; action.time = progress * clip.duration; mixer.update(0); scene.updateMatrixWorld(true);
      const plate = meshes.find(mesh => mesh.userData.cad_part_id === 'CheckPlate'), plunger = meshes.find(mesh => mesh.userData.cad_part_id === 'Plunger');
      assert.ok(Math.abs(plate.position.y - plunger.position.y - opening) < .000001, 'check plate opens on replenishment, stays closed on loading');
      const body = meshes.find(mesh => mesh.userData.cad_part_id === 'LifterBody');
      assert.ok(Math.abs(plunger.position.y - body.position.y - (progress === .25 ? 0 : .0005)) < .000001, 'loaded internals travel with the body; plunger extension occurs on return');
    }
    mixer.stopAllAction(); scene.updateMatrixWorld(true);
  }

  for (const progress of [0, .25, .5, .75, 1]) {
    mixer.stopAllAction(); let clip = animations.find(clip => clip.name === 'Exploded overview'); let action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play(); action.clampWhenFinished = true; action.paused = true; action.time = progress * clip.duration; mixer.update(0); scene.updateMatrixWorld(true);
    const exploded = meshes.map(mesh => mesh.matrixWorld.clone());
    mixer.stopAllAction(); clip = animations.find(clip => clip.name === 'Reassembly overview'); action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play(); action.clampWhenFinished = true; action.paused = true; action.time = (1 - progress) * clip.duration; mixer.update(0); scene.updateMatrixWorld(true);
    meshes.forEach((mesh, index) => assert.ok(mesh.matrixWorld.elements.every((value, axis) => Math.abs(value - exploded[index].elements[axis]) < 2e-7)));
  }
  mixer.stopAllAction(); scene.updateMatrixWorld(true);
  meshes.forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, bases[index].elements));
});

// Bundle the actual TypeScript adapters, then exercise their public controls with the published assets.
// Vite provides import.meta.env in the app; outside Vite it must be defined. These tests load the local files, as development does.
const build = await rolldown({ input: ['src/viewer/adapters/cylinderAdapter.ts', 'src/viewer/adapters/animatedStudyAdapter.ts'], external: ['three'], logLevel: 'silent', transform: { define: { 'import.meta.env.PROD': 'false' } } });
fs.mkdirSync('.local/motion-tests', { recursive: true }); await build.write({ dir: '.local/motion-tests', format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' }); await build.close();
const { createCylinderSession } = await import('../.local/motion-tests/cylinderAdapter.mjs');
const { createAnimatedStudySession } = await import('../.local/motion-tests/animatedStudyAdapter.mjs');
const registry = read('src/data/models.json');
const realFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const name = String(url).replace(/^\.\//, '').split('?')[0];
  if (name === 'config.json') return new Response('{}');
  return new Response(fs.readFileSync('web/' + name));
};
for (const id of ['cylinder', 'hydraulic-tappet', 'oil-pump', 'accessory-drives']) test(`${id} public viewer controls hold, isolate, switch and replay saved motions`, async () => {
  let tick, renders = 0;
  const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), render() { renders++; }, fit() {}, setPickTargets() {}, setAnimationCallback(callback) { tick = callback; } };
  const creator = id === 'cylinder' ? createCylinderSession : createAnimatedStudySession;
  const session = await creator(registry.find(model => model.id === id), { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore' });
  const explodedId = id === 'cylinder' ? 'exploded' : 'Exploded overview';
  session.features.savedMotions.select(explodedId); session.features.savedMotions.setProgress(62.5);
  const partMeshes = []; runtime.scene.traverse(mesh => { if (mesh.isMesh && mesh.userData.partId) partMeshes.push(mesh); });
  const held = partMeshes.map(mesh => mesh.matrixWorld.clone()); runtime.render();
  assert.equal(session.snapshot().motionProgress, 62.5); assert.equal(session.snapshot().playing, false);
  if (id === 'accessory-drives') {
    session.features.powerPaths.select('magnetos'); session.features.powerPaths.isolate();
    const path = read('web/accessory-drives-contract.json').powerPaths.find(path => path.id === 'magnetos');
    assert.deepEqual(partMeshes.filter(mesh => mesh.visible).map(mesh => mesh.userData.partId).sort(), [...path.parts].sort());
    partMeshes.forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, held[index].elements));
    assert.equal(session.snapshot().motionProgress, 62.5);
    const arrows = runtime.scene.getObjectByName('Output rotation arrows');
    assert.equal(arrows.children.filter(arrow => arrow.visible).length, 2);
    assert.ok(runtime.scene.getObjectByName('Selected power path').children.length > 0);
    session.features.section.setEnabled(true); session.features.section.setAxis('y'); session.features.section.setPosition(65);
    assert.equal(session.snapshot().sectionEnabled, true);
    assert.equal(session.snapshot().motionProgress, 62.5);
    session.features.components.showAll(); session.features.section.reset();
  }
  session.features.components.isolateGroup(id === 'cylinder' ? 'intake' : id === 'oil-pump' ? 'gears' : id === 'accessory-drives' ? 'starter' : 'plunger');
  partMeshes.forEach((mesh, index) => assert.deepEqual(mesh.matrixWorld.elements, held[index].elements));
  assert.ok(partMeshes.some(mesh => !mesh.visible)); session.features.components.showAll(); assert.ok(partMeshes.every(mesh => mesh.visible));
  session.features.savedMotions.select(id === 'cylinder' ? 'reassembly' : 'Reassembly overview'); session.features.savedMotions.setProgress(37.5);
  partMeshes.forEach((mesh, index) => assert.ok(mesh.matrixWorld.elements.every((value, axis) => Math.abs(value - held[index].elements[axis]) < 2e-7)));
  session.features.savedMotions.select(explodedId); session.features.savedMotions.setProgress(62.5);
  session.features.motion.setPlaying(true); assert.equal(typeof tick, 'function'); tick(100);
  assert.equal(session.snapshot().motionProgress, 100); assert.equal(session.snapshot().playing, false);
  session.features.motion.setPlaying(true); assert.equal(session.snapshot().motionProgress, 0); session.features.motion.setPlaying(false);
  session.features.savedMotions.select(id === 'cylinder' ? 'operating' : 'Operating mechanism');
  assert.ok(partMeshes.every(mesh => mesh.matrixWorld.elements.every(Number.isFinite)));
  session.update({ savedMotionId: explodedId, motionProgress: 50 }); assert.equal(session.snapshot().motionProgress, 50);
  const first = session.features.components.items[0].id;
  session.update({ savedMotionId: explodedId, motionProgress: 50, focusParts: [first] });
  assert.equal(session.snapshot().motionProgress, 50);
  assert.ok(partMeshes.filter(mesh => mesh.userData.partId !== first).every(mesh => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).opacity === .12));
  session.dispose(); assert.equal(runtime.scene.children.filter(child => child.name === 'Section cut faces').length, 0); assert.ok(renders > 0);
});
process.on('exit', () => { globalThis.fetch = realFetch; });
