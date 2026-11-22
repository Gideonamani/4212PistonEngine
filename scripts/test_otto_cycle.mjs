import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createCycleVisuals } from '../src/viewer/engineering/cycle-visuals.mjs';
import {
  COMPRESSION_RATIO,
  GAMMA,
  IDEAL_HEAT_RATIO,
  SPARK_ADVANCE_DEG,
  cylinderKinematics,
  cycleValveState,
  ottoState,
  sampleIdealReference,
  sampleOttoCycle,
} from '../src/viewer/engineering/otto-cycle.mjs';
import { sha256FallbackHex, sha256Hex } from '../src/viewer/core/sha256.mjs';
import {
  DIESEL_COMPRESSION_RATIO,
  DIESEL_CUTOFF_ANGLE_DEG,
  DIESEL_CUTOFF_RATIO,
  DIESEL_INJECTION_ADVANCE_DEG,
  dieselKinematics,
  dieselState,
  sampleDieselCycle,
  sampleIdealDieselReference,
} from '../src/viewer/engineering/diesel-cycle.mjs';
import { cycleMeta, cycleState } from '../src/viewer/engineering/cycle-model.mjs';
import {
  TWO_STROKE_COMPRESSION_RATIO,
  TWO_STROKE_SPARK_ADVANCE_DEG,
  sampleIdealTwoStrokeReference,
  sampleTwoStrokeCycle,
  twoStrokePortState,
  twoStrokeState,
} from '../src/viewer/engineering/two-stroke-cycle.mjs';
import { valveTrainPose } from '../src/viewer/engineering/valve-kinematics.mjs';

test('slider-crank kinematics hit exact clearance volume at TDC and total volume at BDC', () => {
  assert.ok(Math.abs(cylinderKinematics(0).volume - 1) < 1e-9);
  assert.ok(Math.abs(cylinderKinematics(180).volume - COMPRESSION_RATIO) < 1e-9);
  assert.ok(Math.abs(cylinderKinematics(360).volume - 1) < 1e-9);
  assert.ok(Math.abs(cylinderKinematics(540).volume - COMPRESSION_RATIO) < 1e-9);
  assert.ok(cylinderKinematics(90).velocity > 0, 'descending intake piston has positive velocity');
  assert.ok(cylinderKinematics(270).velocity < 0, 'rising compression piston has negative velocity');
});

test('ideal Otto cycle matches analytical isentropic P–V and T–s relations', () => {
  const ref = sampleIdealReference();
  const expectedP2 = Math.pow(COMPRESSION_RATIO, GAMMA);
  const expectedP3 = expectedP2 * IDEAL_HEAT_RATIO;
  assert.ok(Math.abs(ref.corners[2].pressure - expectedP2) < 1e-9);
  assert.ok(Math.abs(ref.corners[3].pressure - expectedP3) < 1e-9);
  assert.ok(Math.abs(ref.corners[2].entropy) < 1e-9, 'ideal compression is isentropic (Δs = 0)');
  assert.ok(Math.abs(ref.corners[3].entropy - Math.log(IDEAL_HEAT_RATIO)) < 1e-9);
  assert.ok(Math.abs(ref.corners[4].entropy - ref.corners[3].entropy) < 1e-9, 'ideal expansion is isentropic');
  const midIntake = ottoState(90, 'ideal');
  assert.equal(midIntake.pressure, 1.0);
  assert.equal(midIntake.temperature, 1.0);
});

test('practical Otto cycle reflects 20° BTDC spark, rounded ATDC peak, pumping loop, and reduced net work', () => {
  const ref = sampleIdealReference();
  const practical = sampleOttoCycle('practical', 2);
  const peak = practical.samples.reduce((best, s) => (s.pressure > best.pressure ? s : best));
  assert.ok(peak.angle > 360 && peak.angle <= 385, `peak should arrive just after TDC, got ${peak.angle}°`);
  assert.ok(peak.pressure < ref.corners[3].pressure, 'finite burn lowers peak pressure below ideal');
  const workRatio = practical.netWork / ref.netWork;
  assert.ok(workRatio > 0.6 && workRatio < 0.85, `practical net work ratio should sit realistically below ideal, got ${workRatio}`);

  const atSpark = ottoState(360 - SPARK_ADVANCE_DEG, 'practical');
  assert.ok(atSpark.sparkIntensity > 0.2, 'spark fires at 20° BTDC');
  assert.ok(ottoState(90, 'practical').pressure < 1.0, 'practical intake creates suction below atmospheric');
  assert.ok(ottoState(630, 'practical').pressure > 1.0, 'practical exhaust pushes above atmospheric');
});

test('practical valve timing includes overlap at TDC while staying inside the audited 0–7 mm lift envelope', () => {
  const maxLift = 7;
  for (let deg = 0; deg < 720; deg += 1) {
    const v = cycleValveState(deg, maxLift, 'practical');
    assert.ok(v.intakeLift >= 0 && v.intakeLift <= maxLift, `intake lift out of range at ${deg}°`);
    assert.ok(v.exhaustLift >= 0 && v.exhaustLift <= maxLift, `exhaust lift out of range at ${deg}°`);
    const s = ottoState(deg, 'practical', maxLift);
    assert.ok(Number.isFinite(s.pressure) && Number.isFinite(s.temperature) && Number.isFinite(s.entropy));
  }
  const atTdc = cycleValveState(0, maxLift, 'practical');
  assert.equal(atTdc.overlap, true, 'both valves are slightly open during overlap at TDC');
  assert.ok(atTdc.intakeLift > 0 && atTdc.intakeLift < 1.0, 'overlap lift stays small and safe at TDC');
  assert.ok(atTdc.exhaustLift > 0 && atTdc.exhaustLift < 1.0, 'overlap lift stays small and safe at TDC');
  assert.equal(cycleValveState(0, maxLift, 'ideal').overlap, false, 'ideal timing has no overlap');
});

test('SHA-256 fallback matches Node crypto across empty, short, boundary, and multi-block buffers', async () => {
  for (const sample of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), '4212-piston-engine-'.repeat(400)]) {
    const bytes = new TextEncoder().encode(sample);
    const expected = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256FallbackHex(bytes), expected);
    assert.equal(await sha256Hex(bytes.buffer), expected);
  }
});

test('ideal Diesel cycle matches analytical 17.5:1 compression and constant-pressure 2->3 heat addition', () => {
  assert.ok(Math.abs(dieselKinematics(0).volume - 1) < 1e-9);
  assert.ok(Math.abs(dieselKinematics(180).volume - DIESEL_COMPRESSION_RATIO) < 1e-9);
  assert.ok(Math.abs(dieselKinematics(DIESEL_CUTOFF_ANGLE_DEG).volume - DIESEL_CUTOFF_RATIO) < 1e-4);

  const ref = sampleIdealDieselReference();
  const expectedP2 = Math.pow(DIESEL_COMPRESSION_RATIO, GAMMA);
  assert.ok(Math.abs(ref.corners[2].pressure - expectedP2) < 1e-9);
  assert.ok(Math.abs(ref.corners[3].pressure - expectedP2) < 1e-9, 'ideal Diesel 2->3 is constant-pressure');
  assert.ok(Math.abs(ref.corners[3].volume - DIESEL_CUTOFF_RATIO) < 1e-9);
  assert.ok(Math.abs(ref.corners[3].entropy - GAMMA * Math.log(DIESEL_CUTOFF_RATIO)) < 1e-9);

  const midInj = dieselState(372, 'ideal');
  assert.ok(Math.abs(midInj.pressure - expectedP2) < 1e-9, 'live ideal Diesel holds constant pressure during 2->3');
  assert.ok(midInj.injectionIntensity > 0.2, 'direct fuel injector sprays during 2->3');
  assert.equal(midInj.sparkIntensity, 0, 'Diesel compression-ignition never sparks');
});

test('practical Diesel Dual cycle shows 10° BTDC injection, zero spark, compression heating, and finite values', () => {
  const ref = sampleIdealDieselReference();
  const practical = sampleDieselCycle('practical', 2);
  const workRatio = practical.netWork / ref.netWork;
  assert.ok(workRatio > 0.65 && workRatio < 0.98, `practical Diesel net work ratio should sit realistically below ideal, got ${workRatio}`);

  const atInj = cycleState(360 - DIESEL_INJECTION_ADVANCE_DEG + 4, 'practical', 'diesel');
  assert.ok(atInj.injectionIntensity > 0.1, 'practical direct injector starts at 10° BTDC');
  assert.ok(atInj.compressionHeat > 0.85, 'high compression ratio heats pure air sharply near TDC');
  assert.equal(atInj.sparkIntensity, 0);
  assert.equal(cycleMeta('diesel').compressionRatio, DIESEL_COMPRESSION_RATIO);

  for (let deg = 0; deg < 720; deg += 5) {
    const s = dieselState(deg, 'practical');
    assert.ok(Number.isFinite(s.pressure) && Number.isFinite(s.temperature) && Number.isFinite(s.entropy));
    assert.equal(s.sparkIntensity, 0);
  }
});

test('overhead valve train without pushrod solves rocker angle and valve lift cleanly', () => {
  const overheadTrain = {
    valve_axis: [1, 0, 0],
    rocker_pivot_mm: [341, -22.5, -24],
    rocker_axis: [0, 1, 0],
    contact_samples: [
      { lift_mm: 0, rocker_angle_deg: 0 },
      { lift_mm: 7, rocker_angle_deg: -16.2602 },
    ],
  };
  const pose = valveTrainPose(3.5, overheadTrain);
  assert.ok(Math.abs(pose.rockerAngle - -8.1301) < 1e-4);
  assert.deepEqual(pose.valveTranslation, [-3.5, 0, 0]);
});

test('2-stroke loop-scavenged cycle repeats every 360° with realistic piston-port timing and crankcase pump', () => {
  assert.equal(cycleMeta('two-stroke').maxAngle, 360);
  assert.equal(cycleMeta('two-stroke').compressionRatio, TWO_STROKE_COMPRESSION_RATIO);

  // At TDC (0°): intake port uncovered by piston skirt; exhaust & transfer ports closed.
  const tdc = twoStrokePortState(0);
  assert.ok(tdc.intakePortOpen > 0.8, 'piston skirt uncovers crankcase intake port at TDC');
  assert.equal(tdc.exhaustPortOpen, 0, 'exhaust port is sealed at TDC');
  assert.equal(tdc.transferPortOpen, 0, 'transfer ports are sealed at TDC');

  // At BDC (180°): exhaust & transfer ports wide open; crankcase intake port sealed by piston skirt.
  const bdc = twoStrokePortState(180);
  assert.equal(bdc.intakePortOpen, 0, 'piston skirt seals crankcase intake port at BDC');
  assert.ok(bdc.exhaustPortOpen > 0.9, 'exhaust port is wide open at BDC');
  assert.ok(bdc.transferPortOpen > 0.9, 'transfer ports are wide open at BDC');

  // Exhaust opens before transfers on the downstroke (blowdown lead).
  const blowdown = twoStrokePortState(112);
  assert.ok(blowdown.exhaustPortOpen > 0, 'exhaust port opens first for blowdown');
  assert.equal(blowdown.transferPortOpen, 0, 'transfer ports stay closed during initial blowdown');

  // Practical 2-stroke fires at 18° BTDC (342°) and stays finite across all 360°.
  const atSpark = cycleState(360 - TWO_STROKE_SPARK_ADVANCE_DEG + 4, 'practical', 'two-stroke');
  assert.ok(atSpark.sparkIntensity > 0.2, '2-stroke sparks at 18° BTDC');
  const ref = sampleIdealTwoStrokeReference();
  const practical = sampleTwoStrokeCycle('practical', 2);
  assert.ok(practical.netWork > 0 && practical.netWork < ref.netWork);
  for (let deg = 0; deg < 360; deg += 5) {
    const s = twoStrokeState(deg, 'practical');
    assert.ok(Number.isFinite(s.pressure) && Number.isFinite(s.temperature) && Number.isFinite(s.entropy));
  }
});

test('createCycleVisuals initializes and updates cleanly for Otto, Diesel, and 2-stroke landmarks', () => {
  const cases = [
    ['web/motion.json', 'otto', [0, 90, 345, 370, 620]],
    ['web/diesel-cylinder-motion.json', 'diesel', [0, 90, 355, 375, 620]],
    ['web/two-stroke-cylinder-motion.json', 'two-stroke', [0, 60, 145, 220, 345]],
  ];
  for (const [profilePath, cycleType, angles] of cases) {
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const scene = new THREE.Scene();
    const visuals = createCycleVisuals(scene, profile.cycle_landmarks, { fov: 40 });
    visuals.setVisible(true);
    for (const deg of angles) {
      const state = visuals.update(deg, 120, 'practical', 'injected', '', cycleType);
      assert.ok(state && typeof state.description === 'string');
    }
    visuals.dispose();
  }
});
