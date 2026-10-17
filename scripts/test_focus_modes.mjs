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

    // Leaving the spotlight puts the whole model back.
    session.update({ focusParts: undefined });
    assert.ok(looks().every((look) => look === 'normal'));
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

test('animated-study-motion: O(1) part indexing, 720-degree crank angle mapping, display modes, and procedural Three.js motion', async () => {
  const {
    crankAngleForMotion,
    createProceduralStudySampler,
    indexStudyParts,
    resolveMotionDisplay,
  } = await import('../src/viewer/core/animated-study-motion.mjs');

  const root = new THREE.Group();
  const makeMesh = (id) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial());
    m.userData.cad_part_id = id;
    root.add(m);
    return m;
  };
  const crank = makeMesh('Crankshaft');
  const piston1 = makeMesh('Piston1');
  const caseLeft = makeMesh('CrankcaseLeft');
  const bolt1 = makeMesh('CaseThruBolt1');

  const { meshes, partsById } = indexStudyParts(root);
  assert.equal(meshes.length, 4);
  assert.equal(partsById.get('Crankshaft'), crank);
  assert.equal(partsById.get('Piston1'), piston1);
  assert.equal(partsById.get('CrankcaseLeft'), caseLeft);
  assert.equal(partsById.get('CaseThruBolt1'), bolt1);

  const explodeMotion = { id: 'Explode - illustrative layout', procedural: { type: 'explode' } };
  const collapseMotion = { id: 'Collapse - illustrative layout', procedural: { type: 'collapse' } };
  const cycleMotion = {
    id: 'Core cycle - illustrative',
    degrees: 720,
    procedural: { type: 'gtsio-core-cycle', degrees: 720 },
    display: {
      defaultViewMode: 'core',
      allowAssembled: true,
      visiblePartIds: ['Crankshaft', 'Piston1'],
      ghostPartIds: ['CrankcaseLeft'],
    },
  };

  assert.equal(crankAngleForMotion(explodeMotion, 50), undefined);
  assert.equal(crankAngleForMotion(cycleMotion, 0), 0);
  assert.equal(crankAngleForMotion(cycleMotion, 25), 180);
  assert.equal(crankAngleForMotion(cycleMotion, 50), 360);
  assert.equal(crankAngleForMotion(cycleMotion, 100), 720);

  const coreDisplay = resolveMotionDisplay(cycleMotion, [], 'default');
  assert.equal(coreDisplay.viewMode, 'core');
  assert.equal(coreDisplay.allowAssembled, true);
  assert.equal(coreDisplay.hasDisplayFilter, true);
  assert.ok(coreDisplay.visibleSet.has('Crankshaft'));
  assert.ok(coreDisplay.visibleSet.has('Piston1'));
  assert.ok(coreDisplay.visibleSet.has('CrankcaseLeft'), 'ghostPartIds are kept visible so they render with ghost opacity');
  assert.ok(!coreDisplay.visibleSet.has('CaseThruBolt1'));
  assert.ok(coreDisplay.ghostSet.has('CrankcaseLeft'));

  const assembledDisplay = resolveMotionDisplay(cycleMotion, [], 'assembled');
  assert.equal(assembledDisplay.viewMode, 'assembled');
  assert.equal(assembledDisplay.hasDisplayFilter, false);
  assert.equal(assembledDisplay.visibleSet, null);
  assert.equal(assembledDisplay.ghostSet.size, 0);

  const contract = {
    procedural: { stageEnds: [0, 0.18, 0.36, 0.58, 0.8, 1] },
    parts: [
      { id: 'Crankshaft', body: 'crank', cycle_visible: true, explosion: { stage: 5, offset_mm: [0, 0, 0] } },
      { id: 'Piston1', body: 'piston1', cycle_visible: true, explosion: { stage: 5, offset_mm: [0, 0, 0] } },
      { id: 'CrankcaseLeft', body: 'fixed:CrankcaseLeft', cycle_visible: false, explosion: { stage: 4, offset_mm: [-230, 260, 0] } },
      { id: 'CaseThruBolt1', body: 'fixed:CaseThruBolt1', cycle_visible: false, explosion: { stage: 1, offset_mm: [-460, -130, 0] } },
    ],
  };
  const sampler = createProceduralStudySampler(contract, partsById, root);
  assert.equal(sampler.supports(explodeMotion), true);
  assert.equal(sampler.supports(collapseMotion), true);
  assert.equal(sampler.supports(cycleMotion), true);

  sampler.apply(explodeMotion, 100);
  assert.ok(Math.abs(caseLeft.matrixWorld.elements[12] - (-0.23)) < 1e-9);
  assert.ok(Math.abs(caseLeft.matrixWorld.elements[14] - (-0.26)) < 1e-9);

  sampler.apply(collapseMotion, 0);
  assert.ok(Math.abs(caseLeft.matrixWorld.elements[12] - (-0.23)) < 1e-9);
  sampler.apply(collapseMotion, 100);
  assert.ok(Math.abs(caseLeft.matrixWorld.elements[12]) < 1e-9);

  sampler.apply(cycleMotion, 25); // 180 deg crank angle -> Piston1 at BDC (-2 * throw = -0.1016 m)
  assert.ok(Math.abs(piston1.matrixWorld.elements[12] - (-0.1016)) < 1e-6);
  sampler.apply(cycleMotion, 100); // 720 deg -> back to TDC rest pose
  assert.ok(Math.abs(piston1.matrixWorld.elements[12]) < 1e-9);
});

test('animatedStudyAdapter: respects per-motion display (core vs assembled viewMode, ghostPartIds) and reports 720-degree crank angle', async () => {
  const baseContract = JSON.parse(fs.readFileSync('web/hydraulic-tappet-contract.json', 'utf8'));
  const allPartIds = baseContract.parts.map((p) => p.id);
  const ghostId = allPartIds[0];
  const coreIds = allPartIds.slice(1, 4);
  const hiddenId = allPartIds[4];
  const customContract = {
    ...baseContract,
    parts: baseContract.parts.map((p, idx) => ({
      ...p,
      body: idx === 1 ? 'piston1' : `fixed:${p.id}`,
      cycle_visible: coreIds.includes(p.id),
      explosion: { stage: 1, offset_mm: [idx * 10, 0, 0] },
    })),
    motions: [
      ...baseContract.motions,
      {
        id: 'Core cycle - illustrative',
        label: 'Core cycle (illustrative)',
        loop: true,
        duration: 12,
        degrees: 720,
        procedural: { type: 'gtsio-core-cycle', degrees: 720 },
        display: {
          defaultViewMode: 'core',
          allowAssembled: true,
          visiblePartIds: coreIds,
          ghostPartIds: [ghostId],
        },
        stages: [
          { progress: 0, label: 'Power' },
          { progress: 50, label: 'Intake' },
          { progress: 100, label: 'Repeat' },
        ],
      },
    ],
  };

  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const name = String(url).replace(/^\.\//, '').split('?')[0];
    if (name === 'custom-study-contract.json') return new Response(JSON.stringify(customContract));
    return prevFetch(url);
  };
  try {
    const baseDef = registry.find((m) => m.id === 'hydraulic-tappet');
    const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), render() {}, fit() {}, setPickTargets() {}, setAnimationCallback() {} };
    const session = await createAnimatedStudySession(
      { ...baseDef, contractUrl: './custom-study-contract.json' },
      { runtime, signal: new AbortController().signal, onProgress() {}, onChange() {}, profile: 'explore', savedMotionId: 'Core cycle - illustrative', motionProgress: 25 },
    );
    const meshesById = new Map();
    runtime.scene.traverse((obj) => { if (obj.isMesh && obj.userData.partId) meshesById.set(obj.userData.partId, obj); });

    assert.equal(session.snapshot().savedMotionId, 'Core cycle - illustrative');
    assert.equal(session.snapshot().motionViewMode, 'core');
    assert.equal(session.snapshot().motionAllowAssembled, true);
    assert.equal(session.snapshot().angle, 180);
    assert.equal(lookOf(meshesById.get(ghostId)), 'ghost', 'housing part in ghostPartIds is drawn as ghost in core mode');
    for (const id of coreIds) {
      assert.equal(lookOf(meshesById.get(id)), 'normal', `core part ${id} is drawn solid in core mode`);
    }
    assert.equal(lookOf(meshesById.get(hiddenId)), 'hidden', 'non-core part outside visiblePartIds is hidden in core mode');

    session.features.savedMotions.setViewMode('assembled');
    assert.equal(session.snapshot().motionViewMode, 'assembled');
    assert.equal(lookOf(meshesById.get(ghostId)), 'normal', 'assembled mode restores ghosted housing to normal');
    assert.equal(lookOf(meshesById.get(hiddenId)), 'normal', 'assembled mode reveals non-core parts');

    session.features.savedMotions.setViewMode('core');
    assert.equal(session.snapshot().motionViewMode, 'core');
    assert.equal(lookOf(meshesById.get(ghostId)), 'ghost');
    assert.equal(lookOf(meshesById.get(hiddenId)), 'hidden');

    session.features.savedMotions.setProgress(50);
    assert.equal(session.snapshot().angle, 360);
    session.dispose();
  } finally {
    globalThis.fetch = prevFetch;
  }
});


