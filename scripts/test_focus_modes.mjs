import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { rolldown } from 'rolldown';
import { FOCUS_MODES, HIGHLIGHT_COLOR, PALE_COLOR, XRAY_COLOR, XRAY_OPACITY } from '../src/viewer/core/focus-style.mjs';

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

    session.features.focus.setMode('highlight');
    assert.equal(session.snapshot().focusMode, 'highlight');
    const highlighted = count(looks());
    assert.ok(highlighted.pale > 0 && highlighted.highlight > 0, `highlight colours some parts and turns the rest pale: ${JSON.stringify(highlighted)}`);
    assert.equal(highlighted.ghost ?? 0, 0, 'highlight leaves no ghosts');
    assert.equal(highlighted.hidden ?? 0, 0, 'highlight hides nothing');
    assert.equal(highlighted.pale, xrayCount.ghost, 'the parts that ghost in x-ray are the ones highlight turns pale');
    assert.equal(highlighted.highlight, xrayCount.normal, 'the parts that stay solid in x-ray are the ones highlight colours');

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

    // Leaving the spotlight puts the whole model back.
    session.update({ focusParts: undefined });
    assert.ok(looks().every((look) => look === 'normal'));
    session.dispose();
  });
}

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
