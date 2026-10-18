import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { COMPONENT_METADATA, getComponentMetadata, GTSIO_MODEL_ID } from '../src/data/componentMetadata.ts';
import { GTSIO_PART_ARCHETYPES } from '../src/data/gtsioPartArchetypes.ts';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const registry = readJson('src/data/models.json');

/** Part ids a contract (or the cylinder's component tree) offers to the part card. */
function contractIds(contract) {
  if (Array.isArray(contract.parts)) return contract.parts.map((part) => part.id);
  if (Array.isArray(contract.teaching_components)) return contract.teaching_components.map((part) => part.id);
  return [];
}
function treeIds(node, out = []) {
  if (node?.kind === 'component') out.push(node.id);
  for (const child of node?.children ?? []) treeIds(child, out);
  return out;
}

test('getComponentMetadata resolves GTSIO-520-H archetype data for the R10 model', () => {
  const samples = [
    { id: 'ConnectingRod1', expectedPN: '633403', system: 'Reciprocating assembly' },
    { id: 'ConnectingRod6', expectedPN: '633403', system: 'Reciprocating assembly' },
    { id: 'Piston1', expectedPN: '631475', system: 'Reciprocating assembly' },
    { id: 'PistonPin2', expectedPN: '630046', system: 'Reciprocating assembly' },
    { id: 'CompressionRingA1', expectedPN: '630752', system: 'Reciprocating assembly' },
    { id: 'Crankshaft', expectedPN: '535661', system: 'Reciprocating assembly' },
    { id: 'CylinderBarrel1', expectedPN: '635448', system: 'Cylinder assembly' },
    { id: 'CylinderHead1', expectedPN: '635448A1', system: 'Cylinder assembly' },
    { id: 'IntakeValve1', expectedPN: '539988', system: 'Valve train' },
    { id: 'ExhaustValve1', expectedPN: '635720', system: 'Valve train' },
    { id: 'IntakeRocker1', expectedPN: '539742', system: 'Valve train' },
    { id: 'ExhaustRocker1', expectedPN: '539743', system: 'Valve train' },
    { id: 'Pushrod1', expectedPN: '538304', system: 'Valve train' },
    { id: 'HydraulicLifter1', expectedPN: '628488', system: 'Valve train' },
    { id: 'Camshaft', expectedPN: '535661-CAM', system: 'Valve train' },
    { id: 'PropellerDriveGear', expectedPN: '636000', system: 'Reduction gear & propeller drive' },
    { id: 'PropellerShaft', expectedPN: '636005', system: 'Reduction gear & propeller drive' },
    { id: 'QuillShaft', expectedPN: '636002', system: 'Reduction gear & propeller drive' },
    { id: 'CrankcaseLeft', expectedPN: '635441', system: 'Crankcase & power output' },
    { id: 'CrankcaseRight', expectedPN: '635440', system: 'Crankcase & power output' },
    { id: 'OilPumpHousing', expectedPN: '631714', system: 'Lubrication system' },
    { id: 'OilFilter', expectedPN: '538727', system: 'Lubrication system' },
    { id: 'OilSump', expectedPN: '631682', system: 'Lubrication system' },
    { id: 'StarterAdapter', expectedPN: '633402', system: 'Crankcase & power output' },
    { id: 'AlternatorDriveGear', expectedPN: '535908', system: 'Crankcase & power output' },
    { id: 'MagnetoDriveGear', expectedPN: '536563', system: 'Ignition system' },
  ];

  for (const sample of samples) {
    const meta = getComponentMetadata(sample.id, undefined, undefined, GTSIO_MODEL_ID);
    // partNumber/source are engineering-only references (IO-520 catalogue, unverified for this engine); the student card does not show them.
    assert.equal(meta.partNumber, sample.expectedPN, `Expected partNumber ${sample.expectedPN} for ${sample.id}, got ${meta.partNumber}`);
    assert.equal(meta.system, sample.system, `Expected system ${sample.system} for ${sample.id}, got ${meta.system}`);
    assert.ok(meta.function.length > 20, `Expected detailed function for ${sample.id}`);
    assert.ok(!meta.function.includes('retained source identity'), `Placeholder function found for ${sample.id}`);
    assert.ok(meta.material.length > 10, `Expected specific material for ${sample.id}`);
    assert.ok(meta.source && meta.source.length > 5, `Expected source citation for ${sample.id}`);
  }
});

test('GTSIO archetype rules apply to the R10 model id only', () => {
  for (const id of ['Piston1', 'Crankshaft', 'PistonRingA1', 'CylinderHead1']) {
    for (const modelId of [undefined, '', 'langley-manly-balzer-1903', 'wright-1903-reconstruction', 'cylinder']) {
      const meta = getComponentMetadata(id, undefined, undefined, modelId);
      assert.equal(meta.partNumber, undefined, `${id} on ${modelId ?? 'no model'} must carry no part number`);
      assert.equal(meta.source, undefined, `${id} on ${modelId ?? 'no model'} must carry no source`);
    }
  }
});

test('no GTSIO-derived metadata appears on any other model', () => {
  const gtsioText = new Set(GTSIO_PART_ARCHETYPES.flatMap((rule) => [rule.function, rule.material, rule.operatingConditions, rule.partNumber, rule.source]));

  // Every contract in web/, each under the model id the registry gives it (an unregistered contract still counts as "not R10").
  const contracts = readdirSync(new URL('../web/', import.meta.url)).filter((name) => name.endsWith('-contract.json'));
  const targets = contracts.map((name) => {
    const model = registry.find((entry) => entry.contractUrl?.replace(/^\.\//, '').replace(/\?.*$/, '') === name);
    return { name, modelId: model?.id ?? name.replace(/-contract\.json$/, ''), ids: contractIds(readJson(`web/${name}`)) };
  });
  // The cylinder has no contract: its part ids come from the component tree.
  const tree = readJson('web/component-tree.json');
  targets.push({ name: 'component-tree.json', modelId: tree.modelId, ids: treeIds(tree.root) });

  const others = targets.filter((target) => target.modelId !== GTSIO_MODEL_ID);
  assert.ok(others.length >= 7, `Expected the other models' contracts to be covered, got ${others.map((target) => target.name).join(', ')}`);
  assert.ok(targets.some((target) => target.modelId === GTSIO_MODEL_ID), 'The R10 contract must be found as the GTSIO model');

  let checked = 0;
  for (const { name, modelId, ids } of others) {
    assert.ok(ids.length > 0, `${name} lists no part ids`);
    for (const id of ids) {
      const meta = getComponentMetadata(id, undefined, undefined, modelId);
      assert.equal(meta.partNumber, undefined, `${name}: ${id} shows part number ${meta.partNumber}`);
      assert.equal(meta.source, undefined, `${name}: ${id} shows source ${meta.source}`);
      // Text a model's own hand-written register supplies is its own; anything else must not equal a GTSIO rule's text.
      if (id in COMPONENT_METADATA) {
        checked++;
        continue;
      }
      for (const field of ['function', 'material', 'operatingConditions']) {
        assert.ok(!gtsioText.has(meta[field]), `${name}: ${id} ${field} comes from a GTSIO archetype rule`);
      }
      checked++;
    }
  }
  assert.ok(checked > 800, `Expected to check every non-R10 part id, checked ${checked}`);
});

test('the student part card shows no part number or source, and card titles carry no P/N suffix', () => {
  const card = readFileSync(new URL('../src/viewer/PartCard.tsx', import.meta.url), 'utf8');
  assert.ok(!/partNumber|data\.source|Part No\./.test(card), 'PartCard must not render part numbers or sources');

  const contract = readJson('web/gtsio520-r10-contract.json');
  for (const part of contract.parts) {
    assert.ok(!/P\/N/.test(part.display_label || ''), `display_label of ${part.id} carries a part number: ${part.display_label}`);
    assert.ok(!/P\/N|X-30040A/.test(part.label || ''), `label of ${part.id} carries a part number: ${part.label}`);
  }
  assert.ok(!/X-30040A/.test(JSON.stringify(registry)), 'The model registry must not cite the IO-520 catalogue');
});

test('R10 contract keeps engineering-only part references, flagged as unverified', () => {
  const contract = readJson('web/gtsio520-r10-contract.json');
  assert.equal(contract.parts.length, 1396);
  assert.equal(contract.part_reference_status?.audience, 'engineering-only');

  let withPartNumber = 0;
  for (const p of contract.parts) {
    if (p.part_number) withPartNumber++;
    assert.ok(!p.description.includes('retained source identity'), `Placeholder description on part ${p.id}`);
    assert.ok(p.material_spec, `Missing material spec on part ${p.id}`);
    assert.ok(p.source_locator, `Missing source locator on part ${p.id}`);
  }

  // The data is kept for the session that verifies it; "present" here does not mean "correct".
  assert.equal(withPartNumber, 1396, 'The engineering-only part_number field must stay on all 1,396 parts');
  const definitions = readJson('data/gtsio520-component-definitions.json');
  assert.ok(Object.keys(definitions.definitions).length > 0, 'data/gtsio520-component-definitions.json must not be emptied');
});
