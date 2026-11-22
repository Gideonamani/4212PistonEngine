/**
 * Synchronized single-cylinder 2-stroke loop-scavenged spark-ignition cycle solver (Ideal vs. Practical).
 *
 * Uses illustrative valveless piston-ported 2-stroke geometry (76 x 64 mm, 9.5:1 geometric CR,
 * exhaust port X = 110..131 mm, twin transfer ports X = 108..122 mm, crankcase intake port X = 81..99 mm,
 * 18° BTDC spark advance, firing once every 360° crank revolution).
 * Curves and port timing are illustrative teaching schematics, not CFD or measured OEM test data.
 */

import { GAMMA, IDEAL_HEAT_RATIO } from './otto-cycle.mjs';

export const TWO_STROKE_COMPRESSION_RATIO = 9.5;
export const TWO_STROKE_CRANK_RADIUS_MM = 32.0;
export const TWO_STROKE_ROD_LENGTH_MM = 112.0;
export const TWO_STROKE_SPARK_ADVANCE_DEG = 18; // Fires at 342° (18° BTDC) every 360° revolution

const wrap360 = (degrees) => ((degrees % 360) + 360) % 360;
const smoothstep = (e0, e1, x) => {
  if (e1 <= e0) return x >= e1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Exact slider-crank kinematics over 0–360° (0° = TDC, 180° = BDC, 360° = TDC). */
export function twoStrokeKinematics(degrees, compressionRatio = TWO_STROKE_COMPRESSION_RATIO) {
  const angle = wrap360(degrees);
  const rad = (angle * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const reach = Math.sqrt(TWO_STROKE_ROD_LENGTH_MM ** 2 - (TWO_STROKE_CRANK_RADIUS_MM * sinA) ** 2);
  const xPin = TWO_STROKE_CRANK_RADIUS_MM * cosA + reach;
  const xTdc = TWO_STROKE_ROD_LENGTH_MM + TWO_STROKE_CRANK_RADIUS_MM; // 144.0 mm
  const stroke = 2 * TWO_STROKE_CRANK_RADIUS_MM; // 64.0 mm
  const strokeFraction = Math.max(0, Math.min(1, (xTdc - xPin) / stroke));
  const volume = 1 + (compressionRatio - 1) * strokeFraction;
  const velocity = sinA + (TWO_STROKE_CRANK_RADIUS_MM * sinA * cosA) / reach;
  const pistonCrownMm = xPin + 28.0; // 172 mm at TDC, 108 mm at BDC
  const pistonSkirtBottomMm = xPin - 28.0; // 116 mm at TDC, 52 mm at BDC
  return { angle, strokeFraction, volume, velocity, xPin, pistonCrownMm, pistonSkirtBottomMm };
}

/** Exact piston-controlled port openings [0..1] derived from the 2-stroke CAD barrel port heights. */
export function twoStrokePortState(degrees) {
  const kin = twoStrokeKinematics(degrees);
  // Exhaust port top = 131 mm, bottom = 110 mm
  const exhaustPortOpen = Math.max(0, Math.min(1, (131.0 - kin.pistonCrownMm) / 21.0));
  // Transfer ports top = 122 mm, bottom = 108 mm
  const transferPortOpen = Math.max(0, Math.min(1, (122.0 - kin.pistonCrownMm) / 14.0));
  // Crankcase intake port X = 81..99 mm (uncovered by rising piston skirt bottom)
  const intakePortOpen = Math.max(0, Math.min(1, (kin.pistonSkirtBottomMm - 81.0) / 18.0));
  // Crankcase pre-compression: rises during downstroke (0->125°), vents through transfer ducts, pulls suction on upstroke
  const a = kin.angle;
  let crankcasePressure = 1.0;
  if (a < 130) {
    crankcasePressure = 1.0 + 0.36 * Math.sin((Math.PI * a) / 130);
  } else if (a < 220) {
    crankcasePressure = 1.24 - 0.32 * smoothstep(130, 220, a);
  } else {
    crankcasePressure = 0.92 + 0.08 * smoothstep(285, 360, a);
  }
  return { ...kin, exhaustPortOpen, transferPortOpen, intakePortOpen, crankcasePressure };
}

function entropyOf(pressure, temperature) {
  return GAMMA * Math.log(Math.max(0.2, temperature)) - (GAMMA - 1) * Math.log(Math.max(0.2, pressure));
}

/**
 * Evaluate full 2-stroke thermodynamic, port-scavenging, and descriptive state at crank angle `degrees`.
 * Repeats every 360° (one complete power cycle per revolution).
 */
export function twoStrokeState(degrees, mode = 'ideal') {
  const r = TWO_STROKE_COMPRESSION_RATIO;
  const ports = twoStrokePortState(degrees);
  const { angle, volume, velocity, exhaustPortOpen, transferPortOpen, intakePortOpen, crankcasePressure } = ports;

  const p2Ideal = Math.pow(r, GAMMA);
  const t2Ideal = Math.pow(r, GAMMA - 1);
  const p3Ideal = p2Ideal * IDEAL_HEAT_RATIO;
  const t3Ideal = t2Ideal * IDEAL_HEAT_RATIO;
  const p4Ideal = p3Ideal * Math.pow(1 / r, GAMMA);
  const t4Ideal = t3Ideal * Math.pow(1 / r, GAMMA - 1);

  let pressure = 1.0;
  let temperature = 1.0;
  let burnFraction = 0;
  let sparkIntensity = 0;
  let flameProgress = 0;
  let stroke = 'Power & Scavenge';
  let strokeIndex = 2;
  let processId = 'power';
  let processLabel = '3 → 4 Expansion';
  let explanation = '';

  if (mode !== 'practical') {
    if (angle >= 357 || angle <= 3) {
      const f = angle >= 357 ? (angle - 357) / 6 : (angle + 3) / 6;
      pressure = p2Ideal * (1 + (IDEAL_HEAT_RATIO - 1) * f);
      temperature = t2Ideal * (1 + (IDEAL_HEAT_RATIO - 1) * f);
      burnFraction = f;
      sparkIntensity = Math.sin(Math.PI * f);
      flameProgress = f;
      stroke = 'Power & Scavenge';
      strokeIndex = 2;
      processId = 'combustion';
      processLabel = '2 → 3 Spark at TDC (every 360°)';
      explanation = 'Ideal 2-stroke combustion: spark fires once every crankshaft revolution at TDC with constant-volume heat addition.';
    } else if (angle < 177) {
      pressure = p3Ideal * Math.pow(1 / volume, GAMMA);
      temperature = t3Ideal * Math.pow(1 / volume, GAMMA - 1);
      burnFraction = 1;
      flameProgress = Math.max(0, 1 - (angle - 3) / 100);
      stroke = 'Power & Scavenge';
      strokeIndex = transferPortOpen > 0.05 ? 0 : exhaustPortOpen > 0.05 ? 3 : 2;
      processId = transferPortOpen > 0.05 ? 'scavenge' : 'power';
      processLabel = transferPortOpen > 0.05 ? 'Loop scavenging (ports open)' : '3 → 4 Power expansion';
      explanation = transferPortOpen > 0.05
        ? 'Piston uncovers exhaust and transfer ports near BDC: pressurized crankcase charge loops up to flush exhaust out.'
        : 'Power downstroke: expanding gas drives the piston down while its underside pre-compresses fresh charge in the sealed crankcase.';
    } else if (angle <= 183) {
      const f = (angle - 177) / 6;
      pressure = p4Ideal + (1.0 - p4Ideal) * f;
      temperature = t4Ideal + (1.0 - t4Ideal) * f;
      stroke = 'Power & Scavenge';
      strokeIndex = 0;
      processId = 'blowdown';
      processLabel = '4 → 1 Scavenge & blowdown';
      explanation = 'Ideal 2-stroke heat rejection at BDC: fresh transfer charge replaces burnt gas without separate exhaust/intake strokes.';
    } else {
      pressure = Math.pow(r / volume, GAMMA);
      temperature = Math.pow(r / volume, GAMMA - 1);
      stroke = 'Compression & Intake';
      strokeIndex = transferPortOpen > 0.05 ? 0 : 1;
      processId = 'compression';
      processLabel = intakePortOpen > 0.05 ? '1 → 2 Comp. + crankcase intake' : '1 → 2 Compression';
      explanation = intakePortOpen > 0.05
        ? 'Rising piston compresses fresh charge above while its skirt uncovers the crankcase intake port, drawing new premix underneath.'
        : 'Upstroke: piston closes the transfer and exhaust ports and compresses the trapped air–fuel charge toward TDC.';
    }
  } else {
    // Practical 2-stroke loop-scavenged cycle:
    // Exhaust opens ~105°, transfer opens ~120°, transfer closes ~240°, exhaust closes ~255°, spark at 342° (18° BTDC).
    const nc = 1.31;
    const ne = 1.44;
    const sparkStart = 360 - TWO_STROKE_SPARK_ADVANCE_DEG; // 342°
    const vTrap = twoStrokeKinematics(255, r).volume; // Effective trapped volume when exhaust port closes

    const closedThermo = (a) => {
      const k = twoStrokeKinematics(a, r);
      const v = k.volume;
      const aRel = a >= 255 ? a - 360 : a; // [-105 .. +105] around TDC = 0°
      const nBlend = nc + (ne - nc) * smoothstep(-18, 22, aRel);
      const tMotor = 1.06 * Math.pow(vTrap / v, nBlend - 1);
      const burnAng = aRel - (-TWO_STROKE_SPARK_ADVANCE_DEG); // 0 at 342°
      const u = Math.max(0, Math.min(1, burnAng / 50));
      const xb = u > 0 ? 1 - Math.exp(-5 * u * u * u) : 0;
      const wallLoss = Math.exp(-0.0022 * Math.max(0, aRel - 12));
      const dtComb = (IDEAL_HEAT_RATIO - 1) * 0.72 * t2Ideal * xb * Math.pow(1.0 / Math.max(1, v), ne - 1) * wallLoss;
      const tTot = tMotor + dtComb;
      const pTot = 1.02 * (vTrap / v) * (tTot / 1.06);
      return { p: pTot, t: tTot, xb };
    };

    if (angle >= sparkStart || angle < 105) {
      const c = closedThermo(angle);
      pressure = c.p;
      temperature = c.t;
      burnFraction = c.xb;
      if (angle >= sparkStart && angle <= 358) {
        sparkIntensity = Math.sin((Math.PI * (angle - sparkStart)) / 18);
      } else if (angle < 6) {
        sparkIntensity = Math.max(0, 1 - angle / 6) * 0.4;
      }
      flameProgress = angle >= sparkStart ? burnFraction : Math.max(0, 1 - angle / 100);
      stroke = angle >= 180 ? 'Compression & Intake' : 'Power & Scavenge';
      strokeIndex = angle >= 342 ? 2 : 2;
      processId = angle >= sparkStart || angle < 26 ? 'combustion' : 'power';
      processLabel = angle >= sparkStart ? 'Spark 18° BTDC (crankcase intake)' : angle < 26 ? '2 → 3 Peak burn & expansion' : '3 → 4 Power + crankcase pump';
      explanation = angle >= sparkStart
        ? 'Spark fires 18° BTDC so pressure peaks just after TDC while the piston skirt still admits fresh premix into the crankcase.'
        : 'Hot gas drives the piston down while the sealed underside compresses the crankcase charge to ~1.35× atmospheric.';
    } else if (angle < 130) {
      // Exhaust blowdown before transfer ports open
      const c = closedThermo(105);
      const w = smoothstep(105, 130, angle);
      pressure = c.p + (1.12 - c.p) * w;
      temperature = c.t + (1.42 - c.t) * w;
      burnFraction = 1;
      stroke = 'Power & Scavenge';
      strokeIndex = 3;
      processId = 'blowdown';
      processLabel = '4 → 1 Exhaust port blowdown';
      explanation = 'Piston crown uncovers the taller exhaust port first (105° ATDC), blowing cylinder pressure down before transfer ports open.';
    } else if (angle < 245) {
      // Active loop scavenging around BDC (120°..240°)
      const scv = Math.sin((Math.PI * (angle - 130)) / 115);
      pressure = 1.04 + 0.08 * (1 - scv);
      temperature = 1.38 - 0.34 * smoothstep(130, 235, angle);
      stroke = angle < 180 ? 'Power & Scavenge' : 'Compression & Intake';
      strokeIndex = 0;
      processId = 'scavenge';
      processLabel = 'Loop scavenging (transfer → exh.)';
      explanation = 'Twin transfer ducts shoot pressurized fresh premix up toward the dome, sweeping burnt gas out of the opposite exhaust port.';
    } else if (angle < 258) {
      // Exhaust closes after transfers (slight fresh-charge short-circuiting loss!)
      const c = closedThermo(258);
      const w = smoothstep(245, 258, angle);
      pressure = 1.04 + (c.p - 1.04) * w;
      temperature = 1.05 + (c.t - 1.05) * w;
      stroke = 'Compression & Intake';
      strokeIndex = 1;
      processId = 'compression';
      processLabel = 'Exhaust port closing';
      explanation = 'Rising piston seals the transfer ports, then closes the exhaust port at 255° so true compression begins.';
    } else {
      const c = closedThermo(angle);
      pressure = c.p;
      temperature = c.t;
      stroke = 'Compression & Intake';
      strokeIndex = 1;
      processId = 'compression';
      processLabel = intakePortOpen > 0.05 ? '1 → 2 Comp. + crankcase intake' : '1 → 2 Effective compression';
      explanation = intakePortOpen > 0.05
        ? 'Upper chamber compresses trapped charge while the rising piston skirt uncovers the crankcase intake port to draw fresh premix.'
        : 'All ports are sealed; the rising piston compresses the trapped air–fuel charge rapidly toward TDC.';
    }
  }

  const entropy = entropyOf(pressure, temperature);
  const combustionGlow = mode === 'practical'
    ? Math.max(0, Math.min(1, (angle >= 342 || angle <= 118) ? burnFraction * Math.exp(-Math.max(0, angle < 180 ? angle - 14 : 0) / 55) : 0))
    : ((angle >= 357 || angle <= 125) ? Math.exp(-Math.max(0, angle < 180 ? angle : 0) / 58) : 0);

  return {
    cycleType: 'two-stroke',
    mode,
    angle,
    stroke,
    strokeIndex,
    volume,
    pressure,
    temperature,
    entropy,
    velocity,
    intakeLift: intakePortOpen * 7,
    exhaustLift: exhaustPortOpen * 7,
    intakePortOpen,
    exhaustPortOpen,
    transferPortOpen,
    crankcasePressure,
    overlap: exhaustPortOpen > 0.05 && transferPortOpen > 0.05,
    burnFraction,
    sparkIntensity,
    injectionIntensity: 0,
    compressionHeat: 0,
    flameProgress,
    combustionGlow,
    compressionRatioProgress: angle >= 180 ? (angle - 180) / 180 : 0,
    processId,
    processLabel,
    explanation,
  };
}

function enclosedWork(samples) {
  let area = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    area += 0.5 * (a.pressure + b.pressure) * (b.volume - a.volume);
  }
  return area;
}

export function sampleTwoStrokeCycle(mode = 'ideal', stepDeg = 2) {
  const samples = [];
  for (let deg = 0; deg < 360; deg += stepDeg) samples.push(twoStrokeState(deg, mode));
  return { mode, samples, powerSamples: samples, pumpingSamples: [], netWork: enclosedWork(samples) };
}

export function sampleIdealTwoStrokeReference() {
  const r = TWO_STROKE_COMPRESSION_RATIO;
  const p2 = Math.pow(r, GAMMA);
  const t2 = Math.pow(r, GAMMA - 1);
  const p3 = p2 * IDEAL_HEAT_RATIO;
  const t3 = t2 * IDEAL_HEAT_RATIO;
  const s3 = Math.log(IDEAL_HEAT_RATIO);
  const p4 = p3 * Math.pow(1 / r, GAMMA);
  const t4 = t3 * Math.pow(1 / r, GAMMA - 1);
  const points = [];
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = r + (1 - r) * t;
    points.push({ volume: v, pressure: Math.pow(r / v, GAMMA), temperature: Math.pow(r / v, GAMMA - 1), entropy: 0 });
  }
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const ratio = 1 + (IDEAL_HEAT_RATIO - 1) * t;
    points.push({ volume: 1, pressure: p2 * ratio, temperature: t2 * ratio, entropy: Math.log(ratio) });
  }
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const v = 1 + (r - 1) * t;
    points.push({ volume: v, pressure: p3 * Math.pow(1 / v, GAMMA), temperature: t3 * Math.pow(1 / v, GAMMA - 1), entropy: s3 });
  }
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const temp = t4 + (1 - t4) * t;
    points.push({ volume: r, pressure: p4 + (1 - p4) * t, temperature: temp, entropy: Math.log(temp) });
  }
  return {
    points,
    netWork: enclosedWork(points),
    corners: {
      1: { volume: r, pressure: 1, temperature: 1, entropy: 0 },
      2: { volume: 1, pressure: p2, temperature: t2, entropy: 0 },
      3: { volume: 1, pressure: p3, temperature: t3, entropy: s3 },
      4: { volume: r, pressure: p4, temperature: t4, entropy: s3 },
    },
  };
}
