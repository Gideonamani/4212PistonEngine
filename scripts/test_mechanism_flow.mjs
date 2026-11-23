import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { driveTrainPlan } from '../src/viewer/engineering/drive-train-flow.mjs';
import {
  TAPPET_STAGE_FLOW,
  accessoryFlowState,
  mechanismFlowSpec,
  motionSupportsMechanismFlow,
  oilPumpFlowState,
  tappetFlowState,
} from '../src/viewer/engineering/mechanism-flow.mjs';

const MODELS = [
  { id: 'hydraulic-tappet', contract: 'web/hydraulic-tappet-contract.json', kind: 'hydraulic-tappet' },
  { id: 'oil-pump', contract: 'web/oil-pump-contract.json', kind: 'oil-pump' },
  { id: 'accessory-drives', contract: 'web/accessory-drives-contract.json', kind: 'accessory-drives' },
];

test('every mechanical model flow spec references only real part IDs in its published contract', () => {
  for (const m of MODELS) {
    const contract = JSON.parse(fs.readFileSync(m.contract, 'utf8'));
    const partIds = new Set(contract.parts.map((p) => p.id));
    const spec = mechanismFlowSpec(m.id, contract);
    assert.ok(spec, `Expected mechanismFlowSpec for ${m.id}`);
    assert.equal(spec.kind, m.kind);
    assert.ok(spec.ghostPartIds.length > 0, `${m.id} should ghost its outer housing`);
    for (const id of spec.ghostPartIds) {
      assert.ok(partIds.has(id), `${m.id}: missing ghostPartId ${id}`);
    }
    for (const id of Object.values(spec.parts || {})) {
      assert.ok(partIds.has(id), `${m.id}: missing referenced part ${id}`);
    }
    assert.equal(motionSupportsMechanismFlow(spec, 'Operating mechanism'), true);
    assert.equal(motionSupportsMechanismFlow(spec, 'Exploded overview'), false);
    assert.equal(motionSupportsMechanismFlow(spec, 'Reassembly overview'), false);
  }
});

test('hydraulic tappet flow names the same stage as the stage buttons at every progress', () => {
  const contract = JSON.parse(fs.readFileSync('web/hydraulic-tappet-contract.json', 'utf8'));
  const operating = contract.motions.find((motion) => /operating/i.test(motion.id));
  // A stage the flow table does not know would silently fall back to the first, so every contract stage must be in it.
  for (const stage of operating.stages) assert.ok(TAPPET_STAGE_FLOW[stage.label], `no oil-flow figures for the contract stage "${stage.label}"`);
  for (let progress = 0; progress <= 100; progress += 1) {
    // The adapter shows the last stage at or before the progress (animatedStudyAdapter.ts, `sample`).
    const shown = [...operating.stages].reverse().find((stage) => progress >= stage.progress);
    assert.match(tappetFlowState(progress, operating.stages).phaseLabel, new RegExp(`^${shown.label} ·`), `progress ${progress}`);
  }
});

test('hydraulic tappet flow state distinguishes trapped-oil load from check-valve replenishment', () => {
  const contract = JSON.parse(fs.readFileSync('web/hydraulic-tappet-contract.json', 'utf8'));
  const { stages } = contract.motions.find((motion) => /operating/i.test(motion.id));
  const underLoad = tappetFlowState(50, stages);
  assert.equal(underLoad.checkValveOpen, false);
  assert.ok(underLoad.trappedLock >= 0.9);
  assert.match(underLoad.phaseLabel, /Trapped oil under load · SEALED/);

  const replenishing = tappetFlowState(80, stages);
  assert.equal(replenishing.checkValveOpen, true);
  assert.ok(replenishing.replenishFlow > 0.5);
  // At 70 % the stage buttons say "Trapped oil under load"; the banner used to say "Replenishing" from 66 %.
  assert.equal(tappetFlowState(70, stages).checkValveOpen, false);
});

test('oil pump flow state activates bypass flow when relief valve opens', () => {
  const pumping = oilPumpFlowState('Operating mechanism', 40);
  assert.equal(pumping.reliefOpen, false);
  assert.ok(pumping.peripheralFlow > 0.8);

  const seated = oilPumpFlowState('Relief valve opening', 0);
  assert.equal(seated.reliefOpen, false);
  assert.equal(seated.bypassFlow, 0);

  const open = oilPumpFlowState('Relief valve opening', 80);
  assert.equal(open.reliefOpen, true);
  assert.ok(open.bypassFlow > 0.7);
});

test('accessory drives banner reflects the plan: a chosen path, or the running train', () => {
  const contract = JSON.parse(fs.readFileSync('web/accessory-drives-contract.json', 'utf8'));
  const running = accessoryFlowState(driveTrainPlan(contract.powerPaths, { motionId: 'Operating mechanism' }), 25);
  assert.equal(running.activePathId, '');
  assert.match(running.phaseLabel, /starter idle/);

  const starter = accessoryFlowState(driveTrainPlan(contract.powerPaths, { motionId: 'Starter engagement and start' }), 50);
  assert.equal(starter.activePathId, 'starter');
  assert.match(starter.phaseLabel, /starter drives the crankshaft gear/);

  const mag = accessoryFlowState(driveTrainPlan(contract.powerPaths, { activePathId: 'magnetos', motionId: 'Operating mechanism' }), 50);
  assert.equal(mag.activePathId, 'magnetos');
  assert.match(mag.phaseLabel, /Magnetos/);
  assert.match(mag.phaseLabel, /driven from the crankshaft gear/);
});

test('a contract can bring its own mechanism flow block, which wins over the built-in entry', () => {
  const own = mechanismFlowSpec('some-new-gear-pump', {
    parts: [{ id: 'GearA' }, { id: 'GearB' }, { id: 'Body' }],
    mechanismFlow: { kind: 'oil-pump', label: 'Scavenge pump flow', ghostPartIds: ['Body', 'Missing'], parts: { driveGear: 'GearA', drivenGear: 'GearB' }, flowMotionPattern: 'run' },
  });
  assert.equal(own.kind, 'oil-pump');
  assert.deepEqual(own.ghostPartIds, ['Body'], 'ids that are not parts of the model are dropped');
  assert.equal(motionSupportsMechanismFlow(own, 'Running'), true);
  assert.equal(motionSupportsMechanismFlow(own, 'Exploded overview'), false);
  assert.equal(mechanismFlowSpec('unknown-model', { parts: [] }), undefined);
});
