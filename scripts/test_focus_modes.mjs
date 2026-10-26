import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { rolldown } from 'rolldown';
import { FOCUS_MODES, HIGHLIGHT_COLOR, PALE_COLOR, XRAY_COLOR, XRAY_OPACITY } from '../src/viewer/core/focus-style.mjs';
import { OVER_GHOST_ORDER } from '../src/viewer/core/ghost-order.mjs';

// Drives the real adapters through every focus mode on the real models. Each mode must give the spotlit parts and the rest the look
// that core/focus-style.mjs promises, switching modes must be reversible, and a new step must start from its own mode.

const build = await rolldown({
  input: ['src/viewer/adapters/cylinderAdapter.ts', 'src/viewer/adapters/fullEngineAdapter.ts', 'src/viewer/adapters/animatedStudyAdapter.ts'],
  external: ['three'],
  logLevel: 'silent',
  transform: { define: { 'import.meta.env.PROD': 'false' } },
});
fs.mkdirSync('.local/focus-tests', { recursive: true });
await build.write({ dir: '.local/focus-tests', format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' });
await build.close();
const { createCylinderSession } = await import('../.local/focus-tests/cylinderAdapter.mjs');
const { createFullEngineSession } = await import('../.local/focus-tests/fullEngineAdapter.mjs');
const { createAnimatedStudySession } = await import('../.local/focus-tests/animatedStudyAdapter.mjs');

const registry = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8'));
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const name = String(url).replace(/^\.\//, '').split('?')[0];
  if (name === 'config.json') return new Response('{}');
  return new Response(fs.readFileSync(`web/${name}`));
};
process.on('exit', () => { globalThis.fetch = realFetch; });

const models = [
  ['cylinder', 'cylinder', createCylinderSession],
  ['hydraulic-tappet', 'hydraulic-tappet', createAnimatedStudySession],
  ['oil-pump', 'oil-pump', createAnimatedStudySession],
  ['accessory-drives', 'accessory-drives', createAnimatedStudySession],
  ['gtsio520-h-v5-teaching-engine', 'full engine', createFullEngineSession, 'web/engine.glb.gz'],
];

/** What a mesh looks like to a student: shown or hidden, and which of the focus looks its first material has. */
function lookOf(mesh) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mesh.visible) return 'hidden';
  const colour = material.color.getHex();
  if (material.transparent && Math.abs(material.opacity - XRAY_OPACITY) < 1e-6 && colour === XRAY_COLOR) return 'ghost';
  if (!material.transparent && colour === PALE_COLOR) return 'pale';
  if (colour === HIGHLIGHT_COLOR) return 'highlight';
  return 'normal';
}

const count = (looks) => looks.reduce((tally, look) => ({ ...tally, [look]: (tally[look] ?? 0) + 1 }), {});

for (const [id, label, create, requires] of models) {
  test(`${label}: every focus mode draws the spotlight and the rest as promised`, { skip: requires && !fs.existsSync(requires) && `${requires} is not restored` }, async () => {
    const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), render() {}, fit() {}, setPickTargets() {}, setAnimationCallback() {} };
    const session = await create(registry.find((model) => model.id === id), { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore' });
    // The models' own parts. Helper meshes (cycle visuals, section faces, arrows) are not spotlit and are left out. The full engine
    // tags no part ids, so every mesh counts there.
    const meshes = [];
    const isHelper = (object) => { for (let node = object; node; node = node.parent) if (/section|arrow|route/i.test(node.name)) return true; return false; };
    runtime.scene.traverse((object) => { if (object.isMesh && object.material && !isHelper(object) && (id.includes('engine') || object.userData.partId)) meshes.push(object); });
    const looks = () => meshes.map(lookOf);

    // Spotlight the first components that really select some parts but not all of them.
    const candidates = session.features.components.items.map((part) => part.id);
    let spotlit;
    for (const candidate of candidates.slice(0, 40)) {
      session.update({ focusParts: [candidate] });
      const tally = count(looks());
      if (tally.ghost > 0 && tally.normal > 0) { spotlit = [candidate]; break; }
    }
    assert.ok(spotlit, 'found a component that spotlights some parts but not all');

    // No spotlight: nothing is ghosted, pale, hidden or highlighted, whatever mode is asked for.
    session.update({ focusParts: undefined, focusMode: 'isolate' });
    assert.equal(session.snapshot().focusActive, false);
    assert.ok(!looks().some((look) => ['ghost', 'pale', 'hidden', 'highlight'].includes(look)), 'no spotlight means every part looks normal');

    session.update({ focusParts: spotlit });
    assert.equal(session.snapshot().focusActive, true);
    assert.equal(session.snapshot().focusMode, 'xray', 'a step with no mode gets x-ray');
    const xray = looks();
    const xrayCount = count(xray);
    assert.ok(xrayCount.ghost > 0 && xrayCount.normal > 0, `x-ray ghosts some parts and keeps others solid: ${JSON.stringify(xrayCount)}`);
    assert.ok(!xray.includes('hidden') && !xray.includes('pale'), 'x-ray hides nothing');

    // The X-ray's solid parts are drawn after the ghost, still opaque, so its layers never cover them (core/ghost-order.mjs).
    const materialsOf = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
    const solid = meshes.filter((mesh, index) => xray[index] === 'normal');
    assert.ok(solid.every((mesh) => mesh.renderOrder === OVER_GHOST_ORDER), 'every solid part comes after the ghost');
    assert.ok(solid.every((mesh) => materialsOf(mesh).every((material) => material.transparent && material.opacity === 1 && material.depthWrite)), 'drawn in the see-through pass, fully opaque and writing depth');
    assert.ok(meshes.filter((mesh, index) => xray[index] === 'ghost').every((mesh) => mesh.renderOrder === 0), 'the ghost stays at the default order');

    session.features.focus.setMode('highlight');
    assert.equal(session.snapshot().focusMode, 'highlight', 'the mode asked for is reported even when it is drawn another way');
    const highlighted = count(looks());
    if (session.snapshot().focusFallback) {
      // The spotlit part sits inside another, which an opaque pale grey would hide: Highlight is drawn exactly as X-ray (spotlight-enclosure.mjs).
      assert.deepEqual(looks(), xray, 'a spotlit part inside another makes Highlight draw as X-ray');
    } else {
      assert.ok(highlighted.pale > 0 && highlighted.highlight > 0, `highlight colours some parts and turns the rest pale: ${JSON.stringify(highlighted)}`);
      assert.equal(highlighted.ghost ?? 0, 0, 'highlight leaves no ghosts');
      assert.equal(highlighted.hidden ?? 0, 0, 'highlight hides nothing');
      assert.equal(highlighted.pale, xrayCount.ghost, 'the parts that ghost in x-ray are the ones highlight turns pale');
      assert.equal(highlighted.highlight, xrayCount.normal, 'the parts that stay solid in x-ray are the ones highlight colours');
    }

    session.features.focus.setMode('isolate');
    assert.equal(session.snapshot().focusMode, 'isolate');
    const isolated = count(looks());
    assert.equal(isolated.hidden, xrayCount.ghost, 'isolate hides exactly the parts x-ray ghosts');
    assert.equal(isolated.normal, xrayCount.normal, 'isolate keeps the spotlit parts as they are');
    assert.equal((isolated.ghost ?? 0) + (isolated.pale ?? 0) + (isolated.highlight ?? 0), 0);

    // Switching back restores everything exactly, in any order.
    session.features.focus.setMode('xray');
    assert.deepEqual(looks(), xray, 'going back to x-ray restores every part');
    session.features.focus.setMode('isolate'); session.features.focus.setMode('highlight'); session.features.focus.setMode('xray');
    assert.deepEqual(looks(), xray, 'and so does a longer round trip');

    // A step sets its own mode, and a step that does not choose one starts from the default, not from what the student last picked.
    session.update({ focusParts: spotlit, focusMode: 'isolate' });
    assert.equal(count(looks()).hidden, xrayCount.ghost);
    session.update({ focusParts: spotlit });
    assert.deepEqual(looks(), xray, 'the next step without a mode is x-ray again');
    for (const mode of FOCUS_MODES) {
      session.update({ focusParts: spotlit, focusMode: mode });
      assert.equal(session.snapshot().focusMode, mode);
    }

    // Leaving the spotlight puts the whole model back, in the order it is normally drawn.
    session.update({ focusParts: undefined });
    assert.ok(looks().every((look) => look === 'normal'));
    assert.ok(meshes.every((mesh) => mesh.renderOrder === 0), 'nothing is drawn over a ghost when nothing is ghosted');
    assert.ok(meshes.every((mesh) => materialsOf(mesh).every((material) => !material.transparent || material.opacity < 1)), 'no opaque part is left in the see-through pass');
    session.dispose();
  });
}

// Highlight turns everything else an opaque pale grey, which hides a spotlit part that sits inside another. The real cylinder lessons have both
// kinds of step: the valves, seats and guides of Valve Operating step 2 are inside the head, the barrel and head of Parts and Construction step 10
// are the outside of the cylinder.
test('cylinder: Highlight becomes X-ray for parts inside others, and stays Highlight for the outside of the cylinder', async () => {
  const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), render() {}, fit() {}, setPickTargets() {}, setAnimationCallback() {} };
  const session = await createCylinderSession(registry.find((model) => model.id === 'cylinder'), { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore' });
  const meshes = [];
  runtime.scene.traverse((object) => { if (object.isMesh && object.material && object.userData.partId) meshes.push(object); });
  const looks = () => meshes.map(lookOf);

  const inside = ['IntakeValve', 'ExhaustValve', 'IntakeSeatInsert', 'ExhaustSeatInsert', 'IntakeValveGuide', 'ExhaustValveGuide'];
  session.update({ focusParts: inside, focusMode: 'xray' });
  const xray = looks();
  session.update({ focusParts: inside, focusMode: 'highlight' });
  assert.equal(session.snapshot().focusMode, 'highlight');
  assert.equal(session.snapshot().focusFallback, true, 'valves, seats and guides are inside the head, so Highlight would hide them');
  assert.deepEqual(looks(), xray, 'and they are drawn as X-ray');
  session.features.focus.setMode('xray');
  assert.equal(session.snapshot().focusFallback, false, 'a style that was not Highlight is never a fallback');

  const outside = ['CylinderBarrel', 'CylinderHead'];
  session.update({ focusParts: outside, focusMode: 'highlight' });
  assert.equal(session.snapshot().focusFallback, false, 'the barrel and the head are the outside of the cylinder');
  const highlighted = count(looks());
  assert.ok(highlighted.highlight > 0 && highlighted.pale > 0 && !highlighted.ghost, `drawn as Highlight: ${JSON.stringify(highlighted)}`);

  // A spotlight that is gone has no fallback to report.
  session.update({ focusParts: undefined });
  assert.equal(session.snapshot().focusFallback, false);
  session.dispose();
});

// A section cut through the spotlit parts shows them on the cut face, so Highlight is drawn as Highlight while the plane passes through them.
// Valve Operating step 2 recommends its own plane, "Valve axis", square to Y through the middle of the cylinder: it cuts all six parts.
test('cylinder: a section through the valves lifts the fallback, and a plane that misses them does not', async () => {
  const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), render() {}, fit() {}, setPickTargets() {}, setAnimationCallback() {} };
  const session = await createCylinderSession(registry.find((model) => model.id === 'cylinder'), { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore' });
  const meshes = [];
  runtime.scene.traverse((object) => { if (object.isMesh && object.material && object.userData.partId) meshes.push(object); });
  const looks = () => meshes.map(lookOf);
  const inside = ['IntakeValve', 'ExhaustValve', 'IntakeSeatInsert', 'ExhaustSeatInsert', 'IntakeValveGuide', 'ExhaustValveGuide'];
  const step = { focusParts: inside, sectionPlane: { label: 'Valve axis', normal: [0, 1, 0], offset: 0.5 } };
  const section = session.features.section;

  session.update({ ...step, focusMode: 'xray' });
  const xray = looks();
  session.update({ ...step, focusMode: 'highlight' });
  assert.equal(session.snapshot().focusFallback, true, 'a new step starts uncut, and the parts are inside the head');

  section.setEnabled(true);
  assert.equal(session.snapshot().sectionPosition, 50);
  assert.equal(session.snapshot().focusFallback, false, 'the Valve axis plane cuts through every spotlit part');
  const cut = count(looks());
  assert.equal(cut.highlight, inside.length, `the spotlit parts are coloured: ${JSON.stringify(cut)}`);
  assert.ok(cut.pale > 0 && !cut.ghost, `and the rest is pale, not ghosted: ${JSON.stringify(cut)}`);

  // The cut lifts the fallback only while it passes through the valves: dragged off them, they are inside the head again.
  const lifted = [];
  for (let position = 0; position <= 100; position += 5) { section.setPosition(position); if (!session.snapshot().focusFallback) lifted.push(position); }
  assert.ok(lifted.length > 0 && lifted.length < 6, `only positions near the valve axes lift it: ${lifted}`);
  assert.deepEqual(lifted, Array.from({ length: lifted.length }, (_, index) => lifted[0] + index * 5), 'one unbroken stretch, so the note does not flicker on and off');
  section.setPosition(100);
  assert.deepEqual(looks(), xray, 'a plane at the edge of the model is drawn as X-ray, exactly');

  // The standard planes: the two valves stand side by side across X, and Z crosses the stems, so neither cuts all six parts at once.
  for (const axis of ['x', 'z']) {
    section.setAxis(axis);
    for (let position = 0; position <= 100; position += 5) {
      section.setPosition(position);
      assert.equal(session.snapshot().focusFallback, true, `the ${axis} plane at ${position}% leaves some spotlit part inside the head`);
    }
  }

  // Back on the step's plane, the reverse cut keeps the other half, which the plane still passes through; turning the cut off falls back.
  section.useRecommended();
  assert.equal(session.snapshot().focusFallback, false);
  section.flip();
  assert.equal(session.snapshot().focusFallback, false, 'the reverse cut shows the other half of each part');
  section.setEnabled(false);
  assert.equal(session.snapshot().focusFallback, true, 'no cut, so the parts are inside the head again');
  assert.deepEqual(looks(), xray);

  // A style that is not Highlight is never a fallback, cut or not.
  section.setEnabled(true);
  session.features.focus.setMode('xray');
  assert.equal(session.snapshot().focusFallback, false);
  session.dispose();
});

// Explore brings a small spotlit part closer (core/spotlight-framing.mjs) when it asks to; a lesson's part chips never do, and a large part
// is left where the camera has it.
test('cylinder: Explore brings a small spotlit part closer, and only when it asks', async () => {
  const moves = [];
  const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(45, 0.46), render() {}, fit() {}, focus: (target, distance) => moves.push({ target, distance }), setPickTargets() {}, setAnimationCallback() {} };
  const session = await createCylinderSession(registry.find((model) => model.id === 'cylinder'), { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore' });
  const meshes = [];
  runtime.scene.traverse((object) => { if (object.isMesh && object.material && object.userData.partId) meshes.push(object); });
  const whole = new THREE.Box3();
  for (const mesh of meshes) whole.expandByObject(mesh);
  const across = (box) => box.getSize(new THREE.Vector3()).length();
  const sizeOf = (id) => across(new THREE.Box3().setFromObject(meshes.find((mesh) => mesh.userData.partId === id)));
  const ids = [...new Set(meshes.map((mesh) => mesh.userData.partId))].sort((a, b) => sizeOf(a) - sizeOf(b));
  const small = ids[0];
  assert.ok(sizeOf(small) < 0.1 * across(whole), `${small} is small next to the cylinder`);

  session.features.focus.set([small], 'xray');
  assert.equal(moves.length, 0, 'without closeUp (a lesson part chip) the camera stays put');
  session.features.focus.set([small], 'xray', { closeUp: true });
  assert.equal(moves.length, 1, 'with closeUp a small part is brought closer');
  const centre = new THREE.Box3().setFromObject(meshes.find((mesh) => mesh.userData.partId === small)).getCenter(new THREE.Vector3());
  assert.ok(moves[0].target.distanceTo(centre) < 1e-9, 'and centred');
  session.features.focus.set(['CylinderBarrel'], 'xray', { closeUp: true });
  assert.equal(moves.length, 1, 'the barrel is large enough to find: the camera stays where the learner put it');
  session.features.focus.set([small], 'isolate', { closeUp: true });
  assert.equal(moves.length, 1, 'Isolate frames the part tightly with fit, not with a close-up');
  session.dispose();
});

// A spotlight that selects nothing ghosts the whole model and looks like a rendering fault, so every teaching component the
// published engine contract names must really match some of the loaded meshes.
test('full engine: every teaching component spotlights at least one part', { skip: !fs.existsSync('web/engine.glb.gz') && 'web/engine.glb.gz is not restored' }, async () => {
  const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), render() {}, fit() {}, setPickTargets() {}, setAnimationCallback() {} };
  const definition = registry.find((model) => model.id === 'gtsio520-h-v5-teaching-engine');
  const session = await createFullEngineSession(definition, { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore' });
  const meshes = [];
  const isHelper = (object) => { for (let node = object; node; node = node.parent) if (/section|arrow|route/i.test(node.name)) return true; return false; };
  runtime.scene.traverse((object) => { if (object.isMesh && object.material && !isHelper(object)) meshes.push(object); });
  const matchesNothing = [];
  for (const { id } of session.features.components.items) {
    session.update({ focusParts: [id] });
    if (!meshes.some((mesh) => lookOf(mesh) === 'normal')) matchesNothing.push(id);
  }
  assert.deepEqual(matchesNothing, [], 'these components select no mesh');
  session.dispose();
});

test('animated-study-motion: display mode filter and 720-degree crank angle helper', async () => {
  const { crankAngleForMotion, resolveMotionDisplay } = await import('../src/viewer/core/animated-study-motion.mjs');
  const cycle = {
    id: 'Core cycle - illustrative',
    degrees: 720,
    display: { defaultViewMode: 'core', allowAssembled: true, visiblePartIds: ['Crankshaft'], ghostPartIds: ['CrankcaseLeft'] },
  };
  assert.equal(crankAngleForMotion(cycle, 25), 180);
  const core = resolveMotionDisplay(cycle, [], 'default');
  assert.equal(core.viewMode, 'core');
  assert.ok(core.visibleSet.has('Crankshaft') && core.visibleSet.has('CrankcaseLeft'));
  assert.ok(core.ghostSet.has('CrankcaseLeft'));
  const assembled = resolveMotionDisplay(cycle, [], 'assembled');
  assert.equal(assembled.viewMode, 'assembled');
  assert.equal(assembled.visibleSet, null);
});



