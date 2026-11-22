/**
 * Unified thermodynamic cycle facade supporting:
 *  - 'otto': 4-stroke spark-ignition (720°, 7.5:1 CR)
 *  - 'diesel': 4-stroke compression-ignition (720°, 17.5:1 CR)
 *  - 'two-stroke': 2-stroke valveless loop-scavenged spark-ignition (360°, 9.5:1 CR)
 */
import {
  COMPRESSION_RATIO as OTTO_CR,
  SPARK_ADVANCE_DEG,
  ottoState,
  sampleIdealReference as sampleIdealOttoReference,
  sampleOttoCycle,
} from './otto-cycle.mjs';
import {
  DIESEL_COMPRESSION_RATIO,
  DIESEL_INJECTION_ADVANCE_DEG,
  dieselState,
  sampleDieselCycle,
  sampleIdealDieselReference,
} from './diesel-cycle.mjs';
import {
  TWO_STROKE_COMPRESSION_RATIO,
  TWO_STROKE_SPARK_ADVANCE_DEG,
  sampleIdealTwoStrokeReference,
  sampleTwoStrokeCycle,
  twoStrokeState,
} from './two-stroke-cycle.mjs';

export function cycleState(degrees, mode = 'ideal', cycleType = 'otto', maxLift = 7) {
  if (cycleType === 'diesel') {
    return {
      ...dieselState(degrees, mode, maxLift),
      intakePortOpen: 0,
      exhaustPortOpen: 0,
      transferPortOpen: 0,
      crankcasePressure: 1,
    };
  }
  if (cycleType === 'two-stroke') return twoStrokeState(degrees, mode);
  return {
    ...ottoState(degrees, mode, maxLift),
    cycleType: 'otto',
    injectionIntensity: 0,
    compressionHeat: 0,
    intakePortOpen: 0,
    exhaustPortOpen: 0,
    transferPortOpen: 0,
    crankcasePressure: 1,
  };
}

export function sampleCycle(mode = 'ideal', cycleType = 'otto', stepDeg = 2) {
  if (cycleType === 'diesel') return sampleDieselCycle(mode, stepDeg);
  if (cycleType === 'two-stroke') return sampleTwoStrokeCycle(mode, stepDeg);
  return sampleOttoCycle(mode, stepDeg);
}

export function sampleReferenceCycle(cycleType = 'otto') {
  if (cycleType === 'diesel') return sampleIdealDieselReference();
  if (cycleType === 'two-stroke') return sampleIdealTwoStrokeReference();
  return sampleIdealOttoReference();
}

export function cycleMeta(cycleType = 'otto') {
  if (cycleType === 'diesel') {
    return {
      cycleType: 'diesel',
      name: 'Diesel',
      maxAngle: 720,
      compressionRatio: DIESEL_COMPRESSION_RATIO,
      eventAngleDeg: 360 - DIESEL_INJECTION_ADVANCE_DEG,
      eventLabel: `${DIESEL_INJECTION_ADVANCE_DEG}° BTDC inj.`,
      provenance: 'Illustrative Diesel model (17.5:1 CR, 10° BTDC direct injection, 2.2 cutoff). Tap or drag a curve to move the piston. Teaching schematic, not CFD or OEM test data.',
    };
  }
  if (cycleType === 'two-stroke') {
    return {
      cycleType: 'two-stroke',
      name: '2-Stroke',
      maxAngle: 360,
      compressionRatio: TWO_STROKE_COMPRESSION_RATIO,
      eventAngleDeg: 360 - TWO_STROKE_SPARK_ADVANCE_DEG,
      eventLabel: `${TWO_STROKE_SPARK_ADVANCE_DEG}° BTDC`,
      provenance: 'Illustrative 2-stroke loop-scavenged model (9.5:1 geometric CR, 18° BTDC spark every 360°, piston-timed ports). Tap or drag a curve to move the piston. Teaching schematic, not CFD.',
    };
  }
  return {
    cycleType: 'otto',
    name: 'Otto',
    maxAngle: 720,
    compressionRatio: OTTO_CR,
    eventAngleDeg: 360 - SPARK_ADVANCE_DEG,
    eventLabel: `${SPARK_ADVANCE_DEG}° BTDC`,
    provenance: 'Illustrative Otto model (7.5:1 CR, 20° BTDC spark per GTSIO-520-H manual). Tap or drag a curve to move the piston. Practical valve overlap and curves are teaching schematics, not CFD or measured engine data.',
  };
}
