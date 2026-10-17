import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getComponentMetadata } from '../src/data/componentMetadata.ts';

test('getComponentMetadata resolves authentic Continental IPC part numbers and engineering data', () => {
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
    const meta = getComponentMetadata(sample.id);
    assert.equal(meta.partNumber, sample.expectedPN, `Expected partNumber ${sample.expectedPN} for ${sample.id}, got ${meta.partNumber}`);
    assert.equal(meta.system, sample.system, `Expected system ${sample.system} for ${sample.id}, got ${meta.system}`);
    assert.ok(meta.function.length > 20, `Expected detailed function for ${sample.id}`);
    assert.ok(!meta.function.includes('retained source identity'), `Placeholder function found for ${sample.id}`);
    assert.ok(meta.material.length > 10, `Expected specific material for ${sample.id}`);
    assert.ok(meta.source && meta.source.length > 5, `Expected source citation for ${sample.id}`);
  }
});

test('R10 contract parts have 100% enriched educational metadata', () => {
  const contract = JSON.parse(readFileSync('web/gtsio520-r10-contract.json', 'utf8'));
  assert.equal(contract.parts.length, 1396);

  let withPartNumber = 0;
  for (const p of contract.parts) {
    if (p.part_number) withPartNumber++;
    assert.ok(!p.description.includes('retained source identity'), `Placeholder description on part ${p.id}`);
    assert.ok(p.material_spec, `Missing material spec on part ${p.id}`);
    assert.ok(p.source_locator, `Missing source locator on part ${p.id}`);
  }

  assert.equal(withPartNumber, 1396, 'All 1,396 parts should carry an authentic part number');
});
