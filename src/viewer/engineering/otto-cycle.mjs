/**
 * Synchronized single-cylinder Otto cycle solver (Ideal vs. Practical) driven by crank angle (0–720°).
 *
 * Uses the GTSIO-520-H geometric compression ratio (7.5:1), slider-crank ratio (r = 50.8 mm, L = 168.275 mm),
 * and spark advance (20° BTDC) from the overhaul manual. Thermodynamic curves, wall heat loss, Wiebe burn duration,
 * and practical valve lead/lag/overlap angles are illustrative teaching schematics (not CFD or measured engine data).
 */

export const COMPRESSION_RATIO = 7.5;
export const GAMMA = 1.4;
export const IDEAL_HEAT_RATIO = 3.0;
export const CRANK_RADIUS_MM = 50.8;
export const ROD_LENGTH_MM = 168.275;
export const SPARK_ADVANCE_DEG = 20; // GTSIO-520-H: 20° BTDC = 340° on 0–720° cycle

// Practical (illustrative) valve events on 0–720° where 0° = TDC start of intake, 360° = TDC ignition.
// Chosen so overlap lift at TDC stays ~0.5 mm (well clear of piston and within audited 0–7 mm contact range).
export const PRACTICAL_VALVE_TIMING = Object.freeze({
  intakeOpenDeg: 700,   // 20° BTDC (lead)
  intakeCloseDeg: 210,  // 30° ABDC (lag)
  exhaustOpenDeg: 505,  // 35° BBDC (early blowdown)
  exhaustCloseDeg: 20,  // 20° ATDC (lag)
});

const wrap720 = (degrees) => ((degrees % 720) + 720) % 720;

const smoothstep = (edge0, edge1, x) => {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Arc span from startDeg to endDeg wrapping across 720°; returns [0, 1] inside span or -1 outside. */
function wrappedSpanFraction(angle, startDeg, endDeg) {
  const span = wrap720(endDeg - startDeg);
  const delta = wrap720(angle - startDeg);
  return delta <= span ? delta / span : -1;
}

/** Exact slider-crank normalized volume V/Vc ∈ [1, r] and dimensionless piston velocity (+ toward BDC). */
export function cylinderKinematics(degrees, compressionRatio = COMPRESSION_RATIO) {
  const angle = wrap720(degrees);
  const rad = (angle * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const reach = Math.sqrt(ROD_LENGTH_MM * ROD_LENGTH_MM - (CRANK_RADIUS_MM * sinA) ** 2);
  const x = CRANK_RADIUS_MM * cosA + reach;
  const xTdc = ROD_LENGTH_MM + CRANK_RADIUS_MM;
  const stroke = 2 * CRANK_RADIUS_MM;
  const strokeFraction = Math.max(0, Math.min(1, (xTdc - x) / stroke));
  const volume = 1 + (compressionRatio - 1) * strokeFraction;
  // Dimensionless velocity (+ when descending toward BDC, - when rising toward TDC).
  const velocity = sinA + (CRANK_RADIUS_MM * sinA * cosA) / reach;
  return { angle, strokeFraction, volume, velocity };
}

/** Valve lifts (mm) for 'ideal' or 'practical' timing modes, bounded strictly to [0, maxLift]. */
export function cycleValveState(degrees, maxLift = 7, mode = 'ideal') {
  const angle = wrap720(degrees);
  const strokeIndex = Math.floor(angle / 180);
  const stroke = ['Intake', 'Compression', 'Power', 'Exhaust'][strokeIndex];
  if (mode !== 'practical') {
    const pulse = (start) => (angle > start && angle < start + 180 ? maxLift * Math.sin((Math.PI * (angle - start)) / 180) ** 2 : 0);
    const intakeLift = pulse(0);
    const exhaustLift = pulse(540);
    return { angle, stroke, strokeIndex, intakeLift, exhaustLift, overlap: false };
  }
  const { intakeOpenDeg, intakeCloseDeg, exhaustOpenDeg, exhaustCloseDeg } = PRACTICAL_VALVE_TIMING;
  const inFrac = wrappedSpanFraction(angle, intakeOpenDeg, intakeCloseDeg);
  const exFrac = wrappedSpanFraction(angle, exhaustOpenDeg, exhaustCloseDeg);
  const intakeLift = inFrac >= 0 ? maxLift * Math.sin(Math.PI * inFrac) ** 2 : 0;
  const exhaustLift = exFrac >= 0 ? maxLift * Math.sin(Math.PI * exFrac) ** 2 : 0;
  return {
    angle,
    stroke,
    strokeIndex,
    intakeLift,
    exhaustLift,
    overlap: intakeLift > 1e-4 && exhaustLift > 1e-4,
  };
}

/** Dimensionless specific entropy change Δs / c_v from intensive state (T, P) relative to ambient (T = 1, P = 1). */
function entropyOf(pressure, temperature) {
  const safeT = Math.max(0.2, temperature);
  const safeP = Math.max(0.2, pressure);
  return GAMMA * Math.log(safeT) - (GAMMA - 1) * Math.log(safeP);
}

/**
 * Evaluate full thermodynamic, combustion, and descriptive state at crank angle `degrees`.
 * @param {number} degrees
 * @param {'ideal' | 'practical'} [mode='ideal']
 * @param {number} [maxLift=7]
 */
export function ottoState(degrees, mode = 'ideal', maxLift = 7) {
  const r = COMPRESSION_RATIO;
  const kin = cylinderKinematics(degrees, r);
  const valves = cycleValveState(degrees, maxLift, mode);
  const { angle, volume, velocity } = kin;

  const p2Ideal = Math.pow(r, GAMMA);
  const t2Ideal = Math.pow(r, GAMMA - 1);
  const p3Ideal = p2Ideal * IDEAL_HEAT_RATIO;
  const t3Ideal = t2Ideal * IDEAL_HEAT_RATIO;
  const p4Ideal = p3Ideal / Math.pow(r, GAMMA);
  const t4Ideal = t3Ideal / Math.pow(r, GAMMA - 1);

  let pressure = 1.0;
  let temperature = 1.0;
  let burnFraction = 0;
  let sparkIntensity = 0;
  let flameProgress = 0;
  let processId = 'intake';
  let processLabel = 'Intake';
  let explanation = '';

  if (mode !== 'practical') {
    if (angle < 180) {
      pressure = 1.0;
      temperature = 1.0;
      processId = 'intake';
      processLabel = 'Intake (0 → 1)';
      explanation = 'Ideal intake: piston descends at constant atmospheric pressure while the intake valve opens cleanly from TDC to BDC.';
    } else if (angle < 358) {
      pressure = Math.pow(r / volume, GAMMA);
      temperature = Math.pow(r / volume, GAMMA - 1);
      processId = 'compression';
      processLabel = '1 → 2 Isentropic compression';
      explanation = 'Ideal compression: both valves are shut, volume falls toward TDC, and pressure and temperature climb adiabatically (constant entropy).';
    } else if (angle <= 362) {
      const f = (angle - 358) / 4;
      pressure = p2Ideal + (p3Ideal - p2Ideal) * f;
      temperature = t2Ideal + (t3Ideal - t2Ideal) * f;
      burnFraction = f;
      sparkIntensity = Math.sin(Math.PI * f);
      flameProgress = f;
      processId = 'combustion';
      processLabel = '2 → 3 Constant-volume heat addition';
      explanation = 'Ideal combustion: all heat is added instantaneously at TDC while volume stays fixed, spiking pressure and entropy straight up.';
    } else if (angle < 538) {
      pressure = p3Ideal / Math.pow(volume, GAMMA);
      temperature = t3Ideal / Math.pow(volume, GAMMA - 1);
      burnFraction = 1;
      flameProgress = Math.max(0, 1 - (angle - 362) / 140);
      processId = 'power';
      processLabel = '3 → 4 Isentropic expansion';
      explanation = 'Ideal power stroke: high-pressure gas expands adiabatically against the descending piston, converting thermal energy into work.';
    } else if (angle <= 542) {
      const f = (angle - 538) / 4;
      pressure = p4Ideal + (1.0 - p4Ideal) * f;
      temperature = t4Ideal + (1.0 - t4Ideal) * f;
      processId = 'blowdown';
      processLabel = '4 → 1 Constant-volume heat rejection';
      explanation = 'Ideal heat rejection: pressure and temperature drop instantaneously back to ambient at BDC before the exhaust sweep.';
    } else {
      pressure = 1.0;
      temperature = 1.0;
      processId = 'exhaust';
      processLabel = 'Exhaust (1 → 0)';
      explanation = 'Ideal exhaust: rising piston sweeps burnt gas out at constant atmospheric pressure with zero pumping loss.';
    }
  } else {
    // Practical cycle: suction drop, polytropic compression/expansion, 20° BTDC spark + Wiebe burn, early EVO blowdown, exhaust back-pressure & overlap.
    const nc = 1.32; // compression polytropic exponent (< gamma due to wall cooling)
    const ne = 1.48; // expansion polytropic exponent (> gamma due to heat loss to barrel/head)
    const pBdc = 0.94;
    const tBdc = 1.02;

    const intakePressure = (a) => {
      const k = cylinderKinematics(a, r);
      return 1.0 - 0.16 * Math.max(0, k.velocity) - 0.04 * Math.sin((Math.PI * Math.max(0, Math.min(180, a))) / 180);
    };
    const exhaustPressure = (a) => {
      const k = cylinderKinematics(a, r);
      const local = Math.max(0, Math.min(180, a - 540));
      return 1.0 + 0.15 * Math.max(0, -k.velocity) + 0.04 * Math.sin((Math.PI * local) / 180);
    };

    const closedThermo = (a) => {
      const k = cylinderKinematics(a, r);
      const v = k.volume;
      // Smooth polytropic blend from nc (before TDC) to ne (after TDC)
      const nBlend = nc + (ne - nc) * smoothstep(340, 385, a);
      const tMotor = tBdc * Math.pow(r / v, nBlend - 1);
      // Wiebe heat release starting at 340° (20° BTDC) over ~58° crank duration
      const ignStart = 360 - SPARK_ADVANCE_DEG; // 340°
      const burnDur = 58;
      const u = Math.max(0, Math.min(1, (a - ignStart) / burnDur));
      const xb = u > 0 ? 1 - Math.exp(-5 * u * u * u) : 0;
      // Added thermal energy decays slightly during expansion due to cylinder-wall heat transfer
      const wallLoss = Math.exp(-0.0022 * Math.max(0, a - 365));
      const dtComb = 2.02 * t2Ideal * xb * Math.pow(1 / v, ne - 1) * wallLoss;
      const tTot = tMotor + dtComb;
      const pTot = pBdc * (r / v) * (tTot / tBdc);
      return { p: pTot, t: tTot, xb };
    };

    const ignStart = 360 - SPARK_ADVANCE_DEG; // 340°
    if (angle >= ignStart - 2 && angle <= ignStart + 14) {
      sparkIntensity = Math.sin((Math.PI * (angle - (ignStart - 2))) / 16);
    }

    if (angle < 180) {
      // Transition out of valve overlap into suction intake
      const pIn = intakePressure(angle);
      if (angle < 20) {
        const w = smoothstep(0, 20, angle);
        const pOverlapStart = 1.04;
        pressure = pOverlapStart + (pIn - pOverlapStart) * w;
        temperature = 1.35 + (1.0 - 1.35) * w;
      } else {
        pressure = pIn;
        temperature = 1.0 + 0.02 * (angle / 180);
      }
      processId = valves.overlap ? 'overlap' : 'intake';
      processLabel = valves.overlap ? 'Valve overlap (scavenging)' : 'Practical intake (pumping suction)';
      explanation = valves.overlap
        ? 'Valve overlap near TDC: the intake valve has already opened while the exhaust valve is finishing closing, helping scavenge residual gas.'
        : 'Practical intake: piston suction pulls cylinder pressure below atmospheric (forming the negative pumping loop on P–V) while fuel enters continuously at the port.';
    } else if (angle < 505) {
      const c = closedThermo(angle);
      pressure = c.p;
      temperature = c.t;
      burnFraction = c.xb;
      if (angle < ignStart) {
        processId = 'compression';
        processLabel = angle < PRACTICAL_VALVE_TIMING.intakeCloseDeg ? '1 → 2 Compression (intake lag)' : '1 → 2 Polytropic compression';
        explanation = angle < PRACTICAL_VALVE_TIMING.intakeCloseDeg
          ? 'Intake closes 30° after BDC (valve lag) so incoming mixture momentum packs a fuller charge before pressure climbs steeply.'
          : 'Practical compression: pressure and temperature rise rapidly, while slight heat transfer to the cylinder walls leans the T–s curve off vertical.';
      } else if (angle < 400) {
        flameProgress = burnFraction;
        processId = 'combustion';
        processLabel = angle < 360 ? '2 → 3 Spark advance (20° BTDC)' : '2 → 3 Finite combustion';
        explanation = angle < 360
          ? 'Dual spark plugs fire at 20° BTDC (GTSIO-520-H timing) while the piston is still rising so peak pressure arrives just after TDC.'
          : 'Burning takes finite crank angle (~55°), rounding the P–V peak slightly after TDC (~12–16° ATDC) at a lower maximum pressure than ideal.';
      } else {
        flameProgress = Math.max(0, 1 - (angle - 398) / 115);
        processId = 'power';
        processLabel = '3 → 4 Polytropic expansion';
        explanation = 'Practical power stroke: hot gas drives the piston down while heat loss to the cooling fins reduces entropy and work compared to the ideal loop.';
      }
    } else if (angle < 565) {
      // Early exhaust blowdown (EVO at 505° = 35° BBDC) rounds the bottom-right P–V corner
      const c = closedThermo(angle);
      const pEx = exhaustPressure(Math.max(540, angle));
      const w = smoothstep(505, 565, angle);
      pressure = c.p + (pEx - c.p) * w;
      temperature = c.t + (1.55 - c.t) * w;
      burnFraction = 1;
      processId = 'blowdown';
      processLabel = angle < 540 ? '4 → 1 Early exhaust blowdown' : 'Exhaust blowdown completion';
      explanation = 'Exhaust valve cracks open 35° before BDC so residual pressure blows down early, rounding the P–V corner and easing the upcoming exhaust stroke.';
    } else {
      const pEx = exhaustPressure(angle);
      if (angle >= 700) {
        const w = smoothstep(700, 720, angle);
        pressure = pEx + (1.04 - pEx) * w;
        temperature = 1.48 + (1.35 - 1.48) * w;
      } else {
        pressure = pEx;
        temperature = 1.55 - 0.07 * ((angle - 565) / 135);
      }
      processId = valves.overlap ? 'overlap' : 'exhaust';
      processLabel = valves.overlap ? 'Valve overlap (intake lead)' : 'Practical exhaust (pumping push)';
      explanation = valves.overlap
        ? 'Intake opens 20° before TDC while the exhaust valve is still open, initiating valve overlap to help flush burnt gas out of the clearance volume.'
        : 'Practical exhaust: the rising piston pushes burnt gas out slightly above atmospheric pressure, contributing to the pumping-loss loop.';
    }
  }

  const entropy = entropyOf(pressure, temperature);

  // Normalized 0..1 intensity cues for 3D visual shaders/materials
  const compressionRatioProgress = angle >= 180 && angle <= 360 ? (angle - 180) / 180 : 0;
  const combustionGlow = mode === 'practical'
    ? Math.max(0, Math.min(1, (angle >= 340 && angle <= 535) ? Math.sin(Math.PI * Math.min(1, burnFraction)) * 0.4 + burnFraction * Math.exp(-Math.max(0, angle - 375) / 85) : 0))
    : (angle >= 358 && angle <= 540 ? Math.exp(-Math.max(0, angle - 360) / 78) : 0);

  return {
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
    sparkIntensity,
    flameProgress,
    combustionGlow,
    compressionRatioProgress,
    processId,
    processLabel,
    explanation,
  };
}

/** Compute signed shoelace work integral ∮ P dV over closed (V, P) samples. */
function enclosedWork(samples) {
  let area = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    // Work done BY gas is +∮ P dV (clockwise loop in V-P plane)
    area += 0.5 * (a.pressure + b.pressure) * (b.volume - a.volume);
  }
  return area;
}

/** Pre-sample full 0–720° curve (every 2°) for fast SVG plotting and pointer-to-angle scrubbing. */
export function sampleOttoCycle(mode = 'ideal', stepDeg = 2) {
  const samples = [];
  for (let deg = 0; deg < 720; deg += stepDeg) {
    samples.push(ottoState(deg, mode));
  }
  // Power loop (180..540) vs pumping loop (540..720 + 0..180)
  const powerSamples = samples.filter((s) => s.angle >= 180 && s.angle <= 540);
  const pumpingSamples = [
    ...samples.filter((s) => s.angle >= 540),
    ...samples.filter((s) => s.angle <= 180),
  ];
  const netWork = enclosedWork(samples);
  return { mode, samples, powerSamples, pumpingSamples, netWork };
}

/** Exact analytical Ideal Otto reference vertices & curves (sharp TDC/BDC corners for crisp overlay). */
export function sampleIdealReference() {
  const r = COMPRESSION_RATIO;
  const p2 = Math.pow(r, GAMMA);
  const t2 = Math.pow(r, GAMMA - 1);
  const p3 = p2 * IDEAL_HEAT_RATIO;
  const t3 = t2 * IDEAL_HEAT_RATIO;
  const s3 = Math.log(IDEAL_HEAT_RATIO);
  const points = [];
  const N = 40;
  // 1 -> 2 isentropic compression
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = r + (1 - r) * t;
    points.push({ volume: v, pressure: Math.pow(r / v, GAMMA), temperature: Math.pow(r / v, GAMMA - 1), entropy: 0 });
  }
  // 2 -> 3 constant volume heat addition
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const temp = t2 + (t3 - t2) * t;
    points.push({ volume: 1, pressure: p2 + (p3 - p2) * t, temperature: temp, entropy: Math.log(temp / t2) });
  }
  // 3 -> 4 isentropic expansion
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const v = 1 + (r - 1) * t;
    points.push({ volume: v, pressure: p3 / Math.pow(v, GAMMA), temperature: t3 / Math.pow(v, GAMMA - 1), entropy: s3 });
  }
  // 4 -> 1 constant volume heat rejection
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const p4 = p3 / Math.pow(r, GAMMA);
    const t4 = t3 / Math.pow(r, GAMMA - 1);
    const temp = t4 + (1 - t4) * t;
    points.push({ volume: r, pressure: p4 + (1 - p4) * t, temperature: temp, entropy: Math.log(temp) });
  }
  const netWork = enclosedWork(points);
  return {
    points,
    netWork,
    corners: {
      1: { volume: r, pressure: 1, temperature: 1, entropy: 0 },
      2: { volume: 1, pressure: p2, temperature: t2, entropy: 0 },
      3: { volume: 1, pressure: p3, temperature: t3, entropy: s3 },
      4: { volume: r, pressure: p3 / Math.pow(r, GAMMA), temperature: t3 / Math.pow(r, GAMMA - 1), entropy: s3 },
    },
  };
}
