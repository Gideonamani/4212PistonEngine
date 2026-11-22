/**
 * Synchronized single-cylinder 4-stroke Aircraft Diesel cycle solver (Ideal Diesel vs. Practical Dual/Sabathé cycle).
 *
 * Uses illustrative modern direct-injection aircraft diesel geometry (83 × 92 mm, 17.5:1 compression ratio,
 * 2.2 cutoff ratio, 10° BTDC direct injection advance). Curves, ignition delay, and practical valve timing are
 * illustrative teaching schematics (not CFD or measured OEM test-cell data).
 */

import { GAMMA, PRACTICAL_VALVE_TIMING, cycleValveState } from './otto-cycle.mjs';

export const DIESEL_COMPRESSION_RATIO = 17.5;
export const DIESEL_CUTOFF_RATIO = 2.2;
export const DIESEL_CRANK_RADIUS_MM = 46.0;
export const DIESEL_ROD_LENGTH_MM = 148.0;
export const DIESEL_INJECTION_ADVANCE_DEG = 10; // Direct injection starts at 10° BTDC = 350°

const wrap720 = (degrees) => ((degrees % 720) + 720) % 720;
const smoothstep = (e0, e1, x) => {
  if (e1 <= e0) return x >= e1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Exact slider-crank normalized volume V/Vc ∈ [1, 17.5] for the diesel cylinder. */
export function dieselKinematics(degrees, compressionRatio = DIESEL_COMPRESSION_RATIO) {
  const angle = wrap720(degrees);
  const rad = (angle * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const reach = Math.sqrt(DIESEL_ROD_LENGTH_MM * DIESEL_ROD_LENGTH_MM - (DIESEL_CRANK_RADIUS_MM * sinA) ** 2);
  const x = DIESEL_CRANK_RADIUS_MM * cosA + reach;
  const xTdc = DIESEL_ROD_LENGTH_MM + DIESEL_CRANK_RADIUS_MM;
  const stroke = 2 * DIESEL_CRANK_RADIUS_MM;
  const strokeFraction = Math.max(0, Math.min(1, (xTdc - x) / stroke));
  const volume = 1 + (compressionRatio - 1) * strokeFraction;
  const velocity = sinA + (DIESEL_CRANK_RADIUS_MM * sinA * cosA) / reach;
  return { angle, strokeFraction, volume, velocity };
}

/** Crank angle (> 360°) where slider-crank volume reaches the Diesel cutoff ratio r_c = 2.2 (~393° = 33° ATDC). */
function findCutoffAngleDeg(r = DIESEL_COMPRESSION_RATIO, rc = DIESEL_CUTOFF_RATIO) {
  let lo = 360;
  let hi = 460;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) * 0.5;
    if (dieselKinematics(mid, r).volume < rc) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}

export const DIESEL_CUTOFF_ANGLE_DEG = findCutoffAngleDeg();

function entropyOf(pressure, temperature) {
  return GAMMA * Math.log(Math.max(0.2, temperature)) - (GAMMA - 1) * Math.log(Math.max(0.2, pressure));
}

/**
 * Evaluate full Diesel thermodynamic, direct-injection, and descriptive state at crank angle `degrees`.
 * @param {number} degrees
 * @param {'ideal' | 'practical'} [mode='ideal']
 * @param {number} [maxLift=7]
 */
export function dieselState(degrees, mode = 'ideal', maxLift = 7) {
  const r = DIESEL_COMPRESSION_RATIO;
  const rc = DIESEL_CUTOFF_RATIO;
  const kin = dieselKinematics(degrees, r);
  const valves = cycleValveState(degrees, maxLift, mode);
  const { angle, volume, velocity } = kin;

  const p2Ideal = Math.pow(r, GAMMA);       // ~54.9
  const t2Ideal = Math.pow(r, GAMMA - 1);   // ~3.14
  const t3Ideal = t2Ideal * rc;             // ~6.91
  const p4Ideal = p2Ideal * Math.pow(rc / r, GAMMA);
  const t4Ideal = t3Ideal * Math.pow(rc / r, GAMMA - 1);

  let pressure = 1.0;
  let temperature = 1.0;
  let burnFraction = 0;
  let injectionIntensity = 0;
  let flameProgress = 0;
  let processId = 'intake';
  let processLabel = 'Pure air intake';
  let explanation = '';

  if (mode !== 'practical') {
    if (angle < 180) {
      pressure = 1.0;
      temperature = 1.0;
      processId = 'intake';
      processLabel = 'Intake (0 → 1 · pure air)';
      explanation = 'Ideal Diesel intake: only pure air is drawn past the intake valve (no fuel enters the intake port).';
    } else if (angle < 360) {
      pressure = Math.pow(r / volume, GAMMA);
      temperature = Math.pow(r / volume, GAMMA - 1);
      processId = 'compression';
      processLabel = '1 → 2 Air compression (17.5:1)';
      explanation = 'Ideal Diesel compression: pure air is compressed to 17.5:1, raising air temperature well above diesel auto-ignition without any spark plug.';
    } else if (angle <= DIESEL_CUTOFF_ANGLE_DEG) {
      const f = (angle - 360) / Math.max(1, DIESEL_CUTOFF_ANGLE_DEG - 360);
      pressure = p2Ideal; // Constant-pressure heat addition!
      temperature = t2Ideal * volume;
      burnFraction = f;
      injectionIntensity = Math.sin(Math.PI * Math.min(1, f));
      flameProgress = f;
      processId = 'combustion';
      processLabel = '2 → 3 Const-P direct injection';
      explanation = 'Ideal Diesel combustion: high-pressure fuel sprays directly into hot compressed air at TDC, auto-igniting at constant pressure as the piston begins descending.';
    } else if (angle < 538) {
      pressure = p2Ideal * Math.pow(rc / volume, GAMMA);
      temperature = t3Ideal * Math.pow(rc / volume, GAMMA - 1);
      burnFraction = 1;
      flameProgress = Math.max(0, 1 - (angle - DIESEL_CUTOFF_ANGLE_DEG) / 135);
      processId = 'power';
      processLabel = '3 → 4 Isentropic expansion';
      explanation = 'Ideal Diesel power stroke: fuel injection cuts off at state 3 and the high-pressure gas expands adiabatically against the descending piston.';
    } else if (angle <= 542) {
      const f = (angle - 538) / 4;
      pressure = p4Ideal + (1.0 - p4Ideal) * f;
      temperature = t4Ideal + (1.0 - t4Ideal) * f;
      processId = 'blowdown';
      processLabel = '4 → 1 Const-V blowdown';
      explanation = 'Ideal heat rejection: pressure and temperature drop to ambient at BDC before the exhaust stroke.';
    } else {
      pressure = 1.0;
      temperature = 1.0;
      processId = 'exhaust';
      processLabel = 'Exhaust (1 → 0)';
      explanation = 'Ideal exhaust: rising piston sweeps burnt combustion gas out through the open exhaust valve.';
    }
  } else {
    // Practical modern aircraft diesel (Dual/Sabathé cycle):
    // 10° BTDC direct injection, ~5° ignition delay, rapid premixed rise + diffusion burn, wall cooling, EVO blowdown, pumping loop.
    const nc = 1.33;
    const ne = 1.46;
    const pBdc = 0.95;
    const tBdc = 1.02;
    const injStart = 360 - DIESEL_INJECTION_ADVANCE_DEG; // 350°
    const ignStart = injStart + 5; // 355° (ignition delay)
    const injEnd = 406;

    const intakePressure = (a) => {
      const k = dieselKinematics(a, r);
      return 1.0 - 0.14 * Math.max(0, k.velocity) - 0.03 * Math.sin((Math.PI * Math.max(0, Math.min(180, a))) / 180);
    };
    const exhaustPressure = (a) => {
      const k = dieselKinematics(a, r);
      const local = Math.max(0, Math.min(180, a - 540));
      return 1.0 + 0.14 * Math.max(0, -k.velocity) + 0.04 * Math.sin((Math.PI * local) / 180);
    };

    const closedThermo = (a) => {
      const k = dieselKinematics(a, r);
      const v = k.volume;
      const nBlend = nc + (ne - nc) * smoothstep(345, 395, a);
      const tMotor = tBdc * Math.pow(r / v, nBlend - 1);
      // Dual-phase burn: rapid premixed phase + slower diffusion phase while injector sprays into omega bowl
      const uFast = Math.max(0, Math.min(1, (a - ignStart) / 26));
      const uDiff = Math.max(0, Math.min(1, (a - (ignStart + 6)) / 62));
      const xbFast = uFast > 0 ? 1 - Math.exp(-5 * uFast * uFast * uFast) : 0;
      const xbDiff = uDiff > 0 ? 1 - Math.exp(-4.2 * uDiff * uDiff) : 0;
      const xb = 0.42 * xbFast + 0.58 * xbDiff;
      const wallLoss = Math.exp(-0.0020 * Math.max(0, a - 370));
      // Calibrated for a realistic Diesel diagram factor (~0.74 of Ideal Diesel work, smooth Dual-cycle rounded top)
      const dtComb = 4.25 * xb * Math.pow(1.45 / Math.max(1, v), ne - 1) * wallLoss;
      const tTot = tMotor + dtComb;
      const pTot = pBdc * (r / v) * (tTot / tBdc);
      return { p: pTot, t: tTot, xb };
    };

    if (angle >= injStart && angle <= injEnd) {
      injectionIntensity = Math.sin((Math.PI * (angle - injStart)) / (injEnd - injStart));
    }

    if (angle < 180) {
      const pIn = intakePressure(angle);
      if (angle < 20) {
        const w = smoothstep(0, 20, angle);
        pressure = 1.04 + (pIn - 1.04) * w;
        temperature = 1.32 + (1.0 - 1.32) * w;
      } else {
        pressure = pIn;
        temperature = 1.0 + 0.02 * (angle / 180);
      }
      processId = valves.overlap ? 'overlap' : 'intake';
      processLabel = valves.overlap ? 'Valve overlap (pure-air scavenge)' : 'Practical pure-air intake';
      explanation = valves.overlap
        ? 'Valve overlap near TDC: fresh pure air helps scavenge residual exhaust out of the clearance volume with zero wasted fuel.'
        : 'Practical Diesel intake: descending piston draws pure air into the cylinder (no throttle plate or intake fuel mist).';
    } else if (angle < 505) {
      const c = closedThermo(angle);
      pressure = c.p;
      temperature = c.t;
      burnFraction = c.xb;
      if (angle < injStart) {
        processId = 'compression';
        processLabel = angle < PRACTICAL_VALVE_TIMING.intakeCloseDeg ? '1 → 2 Compression (intake lag)' : '1 → 2 High-ratio compression';
        explanation = 'Pure air is compressed at 17.5:1 into the piston omega bowl, heating strongly while slight heat transfers to the liquid-cooled cylinder walls.';
      } else if (angle < ignStart) {
        processId = 'combustion';
        processLabel = 'Direct injection (10° BTDC · delay)';
        explanation = 'Common-rail injector sprays fine fuel jets at 10° BTDC; a brief ignition delay (~5°) lets droplets vaporize and mix before auto-ignition.';
      } else if (angle < injEnd + 6) {
        flameProgress = burnFraction;
        processId = 'combustion';
        processLabel = '2 → 3 Auto-ignition & diffusion burn';
        explanation = 'Vaporized fuel auto-ignites spontaneously in the superheated air, producing a rounded Dual-cycle peak followed by steady diffusion burning.';
      } else {
        flameProgress = Math.max(0, 1 - (angle - injEnd) / 105);
        processId = 'power';
        processLabel = '3 → 4 Polytropic expansion';
        explanation = 'Injection has ended; hot combustion gases expand powerfully down the bore while transferring some heat to the cooling jacket.';
      }
    } else if (angle < 565) {
      const c = closedThermo(angle);
      const pEx = exhaustPressure(Math.max(540, angle));
      const w = smoothstep(505, 565, angle);
      pressure = c.p + (pEx - c.p) * w;
      temperature = c.t + (1.45 - c.t) * w;
      burnFraction = 1;
      processId = 'blowdown';
      processLabel = '4 → 1 Early exhaust blowdown';
      explanation = 'Exhaust valve opens 35° before BDC so residual pressure blows down smoothly, rounding the bottom-right corner of the P–V loop.';
    } else {
      const pEx = exhaustPressure(angle);
      if (angle >= 700) {
        const w = smoothstep(700, 720, angle);
        pressure = pEx + (1.04 - pEx) * w;
        temperature = 1.42 + (1.32 - 1.42) * w;
      } else {
        pressure = pEx;
        temperature = 1.45 - 0.03 * ((angle - 565) / 135);
      }
      processId = valves.overlap ? 'overlap' : 'exhaust';
      processLabel = valves.overlap ? 'Valve overlap (intake lead)' : 'Practical exhaust stroke';
      explanation = valves.overlap
        ? 'Intake valve leads TDC by 20° while exhaust finishes closing, flushing the combustion bowl with clean air.'
        : 'Rising piston expels cooled exhaust gas slightly above atmospheric pressure.';
    }
  }

  const entropy = entropyOf(pressure, temperature);
  const compressionHeat = angle >= 180 && angle <= 365 ? Math.pow(Math.max(0, (angle - 180) / 180), 2.2) : 0;
  const combustionGlow = mode === 'practical'
    ? Math.max(0, Math.min(1, angle >= 355 && angle <= 535 ? burnFraction * Math.exp(-Math.max(0, angle - 390) / 85) : 0))
    : (angle >= 360 && angle <= 540 ? Math.min(1, (angle - 360) / 10) * Math.exp(-Math.max(0, angle - DIESEL_CUTOFF_ANGLE_DEG) / 82) : 0);

  return {
    cycleType: 'diesel',
    mode,
    angle,
    stroke: valves.stroke,
    strokeIndex: valves.strokeIndex,
    volume,
    pressure,
    temperature,
    entropy,
    velocity,
    intakeLift: valves.intakeLift,
    exhaustLift: valves.exhaustLift,
    overlap: valves.overlap,
    burnFraction,
    sparkIntensity: 0, // Compression-ignition: never sparks!
    injectionIntensity,
    compressionHeat,
    flameProgress,
    combustionGlow,
    compressionRatioProgress: angle >= 180 && angle <= 360 ? (angle - 180) / 180 : 0,
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

export function sampleDieselCycle(mode = 'ideal', stepDeg = 2) {
  const samples = [];
  for (let deg = 0; deg < 720; deg += stepDeg) samples.push(dieselState(deg, mode));
  const powerSamples = samples.filter((s) => s.angle >= 180 && s.angle <= 540);
  const pumpingSamples = [
    ...samples.filter((s) => s.angle >= 540),
    ...samples.filter((s) => s.angle <= 180),
  ];
  return { mode, samples, powerSamples, pumpingSamples, netWork: enclosedWork(samples) };
}

/** Exact analytical Ideal Diesel reference loop (flat constant-pressure top 2 → 3 on P–V, c_p slope on T–s). */
export function sampleIdealDieselReference() {
  const r = DIESEL_COMPRESSION_RATIO;
  const rc = DIESEL_CUTOFF_RATIO;
  const p2 = Math.pow(r, GAMMA);
  const t2 = Math.pow(r, GAMMA - 1);
  const t3 = t2 * rc;
  const s3 = GAMMA * Math.log(rc);
  const p4 = p2 * Math.pow(rc / r, GAMMA);
  const t4 = t3 * Math.pow(rc / r, GAMMA - 1);
  const points = [];
  const N = 40;
  // 1 -> 2 isentropic compression
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = r + (1 - r) * t;
    points.push({ volume: v, pressure: Math.pow(r / v, GAMMA), temperature: Math.pow(r / v, GAMMA - 1), entropy: 0 });
  }
  // 2 -> 3 constant-pressure heat addition (flat line on P-V!)
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const v = 1 + (rc - 1) * t;
    const temp = t2 * v;
    points.push({ volume: v, pressure: p2, temperature: temp, entropy: GAMMA * Math.log(v) });
  }
  // 3 -> 4 isentropic expansion
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const v = rc + (r - rc) * t;
    points.push({ volume: v, pressure: p2 * Math.pow(rc / v, GAMMA), temperature: t3 * Math.pow(rc / v, GAMMA - 1), entropy: s3 });
  }
  // 4 -> 1 constant-volume blowdown
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
      3: { volume: rc, pressure: p2, temperature: t3, entropy: s3 },
      4: { volume: r, pressure: p4, temperature: t4, entropy: s3 },
    },
  };
}
