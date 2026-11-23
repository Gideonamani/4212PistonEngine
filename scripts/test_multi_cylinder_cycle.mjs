import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  crankAngleForCylinderOtto,
  cylinderForPartId,
  cylinderOttoAngle,
  firingOrderSummary,
  multiCylinderSpec,
  ottoStrokeOf,
} from '../src/viewer/engineering/multi-cylinder-cycle.mjs';

const ENGINES = [
  { id: 'gtsio520-h-r10-mechanism-study', contract: 'web/gtsio520-r10-contract.json', count: 6, firstId: '1', firstStrokeAt0: 'power' },
  { id: 'merlin-iii-operating-study-4', contract: 'web/merlin-iii-operating-study-4-contract.json', count: 12, firstId: '1A', firstStrokeAt0: 'power' },
  { id: 'gnome-monosoupape-1913', contract: 'web/gnome-monosoupape-1913-contract.json', count: 9, firstId: '1', firstStrokeAt0: 'power' },
  { id: 'langley-manly-balzer-1903', contract: 'web/langley-manly-balzer-1903-contract.json', count: 5, firstId: '1', firstStrokeAt0: 'intake' },
  { id: 'wright-1903-reconstruction', contract: 'web/wright-1903-reconstruction-contract.json', count: 4, firstId: '1', firstStrokeAt0: 'power' },
];

test('every multi-cylinder engine spec references only real part IDs in its published contract', () => {
  for (const engine of ENGINES) {
    const contract = JSON.parse(fs.readFileSync(engine.contract, 'utf8'));
    const partIds = new Set(contract.parts.map((p) => p.id));
    const spec = multiCylinderSpec(engine.id, contract);
    assert.ok(spec, `Expected multiCylinderSpec for ${engine.id}`);
    assert.equal(spec.cylinders.length, engine.count, `${engine.id} cylinder count`);
    assert.equal(spec.firingOrder.length, engine.count, `${engine.id} firing order length`);

    for (const cyl of spec.cylinders) {
      assert.ok(partIds.has(cyl.pistonId), `${engine.id}: missing pistonId ${cyl.pistonId}`);
      assert.ok(partIds.has(cyl.barrelId), `${engine.id}: missing barrelId ${cyl.barrelId}`);
      if (cyl.headId) assert.ok(partIds.has(cyl.headId), `${engine.id}: missing headId ${cyl.headId}`);
      if (cyl.intakeValveId) assert.ok(partIds.has(cyl.intakeValveId), `${engine.id}: missing intakeValveId ${cyl.intakeValveId}`);
      if (cyl.exhaustValveId) assert.ok(partIds.has(cyl.exhaustValveId), `${engine.id}: missing exhaustValveId ${cyl.exhaustValveId}`);
      if (cyl.sparkId) assert.ok(partIds.has(cyl.sparkId), `${engine.id}: missing sparkId ${cyl.sparkId}`);
    }
    for (const ghostId of spec.ghostPartIds) {
      assert.ok(partIds.has(ghostId), `${engine.id}: missing ghostPartId ${ghostId}`);
    }
  }
});

test('non-engine mechanical models do not activate multi-cylinder engine cycle specs', () => {
  for (const id of ['hydraulic-tappet', 'oil-pump', 'accessory-drives']) {
    assert.equal(multiCylinderSpec(id, { parts: [], motions: [] }), undefined);
  }
});

test('firing phase math matches each engine 0% start stroke and round-trips cleanly', () => {
  for (const engine of ENGINES) {
    const contract = JSON.parse(fs.readFileSync(engine.contract, 'utf8'));
    const spec = multiCylinderSpec(engine.id, contract);
    const firstAngleAt0 = cylinderOttoAngle(0, spec, engine.firstId);
    assert.equal(ottoStrokeOf(firstAngleAt0), engine.firstStrokeAt0, `${engine.id} cyl ${engine.firstId} stroke at 0°`);

    // Every cylinder in firing order reaches firing TDC (360° Otto) in sequence.
    for (const cyl of spec.cylinders) {
      for (const target of [0, 90, 240, 360, 540, 690]) {
        const crank = crankAngleForCylinderOtto(target, spec, cyl.id);
        const back = cylinderOttoAngle(crank, spec, cyl.id);
        assert.ok(Math.abs(back - target) < 1e-6, `${engine.id} cyl ${cyl.id} round-trip ${target} -> ${crank} -> ${back}`);
      }
    }
  }
});

test('Langley 5-cyl radial matches its documented 0% state: cyl 1 at intake TDC and cyl 3 in exhaust', () => {
  const contract = JSON.parse(fs.readFileSync('web/langley-manly-balzer-1903-contract.json', 'utf8'));
  const spec = multiCylinderSpec('langley-manly-balzer-1903', contract);
  assert.equal(cylinderOttoAngle(0, spec, '1'), 0);
  assert.equal(cylinderOttoAngle(0, spec, '3'), 576);
  assert.equal(ottoStrokeOf(cylinderOttoAngle(0, spec, '3')), 'exhaust');
});

test('firingOrderSummary and cylinderForPartId report live firing status and part ownership', () => {
  const contract = JSON.parse(fs.readFileSync('web/gtsio520-r10-contract.json', 'utf8'));
  const spec = multiCylinderSpec('gtsio520-h-r10-mechanism-study', contract);
  const summaryAt0 = firingOrderSummary(0, spec);
  assert.deepEqual(summaryAt0.map((s) => s.id), ['1', '4', '5', '2', '3', '6']);
  assert.equal(summaryAt0[0].firing, true);
  assert.equal(summaryAt0[0].stroke, 'power');

  // At 120° crank rotation, cylinder 4 is firing.
  const summaryAt120 = firingOrderSummary(120, spec);
  assert.equal(summaryAt120[1].id, '4');
  assert.equal(summaryAt120[1].firing, true);

  assert.equal(cylinderForPartId(spec, 'Piston4'), '4');
  assert.equal(cylinderForPartId(spec, 'IntakeValve6'), '6');
  assert.equal(cylinderForPartId(spec, 'Crankshaft'), undefined);
});
