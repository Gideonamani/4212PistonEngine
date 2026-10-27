// A fingerprint of what the procedural motion actually does, so that "the motion an audit was run against" is something that can be compared.
// It samples every body the evaluator knows at a fixed grid of crank angles, with and without the mirror, rounds each matrix to a nanometre,
// and hashes the lot. If any pose changes, even with the same asset and the same contract, the fingerprint changes. Node only (it uses
// node:crypto): the app does not import it; the tests, the CI check and the MEDIS sampler do. The committed value is
// motion-fingerprint.json; `node scripts/write_motion_fingerprint.mjs` regenerates it. See docs/decisions/002-motion-interface-and-release-envelope.md.

import { createHash } from 'node:crypto';
import { MOTION_API_VERSION, createGtsioBodyEvaluator } from './animated-study-motion.mjs';

const CYLINDERS = [1, 2, 3, 4, 5, 6];
const VALVE_GEAR = ['lifter', 'valve', 'rocker', 'pushrod', 'spring'];

/** Every kind of body the interface names, with the two accessory-gear examples the R10 release uses. */
export const FINGERPRINT_BODIES = Object.freeze([
  'crank', 'cam',
  ...CYLINDERS.map((n) => `rod${n}`),
  ...CYLINDERS.map((n) => `piston${n}`),
  ...VALVE_GEAR.flatMap((kind) => ['Intake', 'Exhaust'].flatMap((name) => CYLINDERS.map((n) => `${kind}:${name}${n}`))),
  'spin:0.000000,100.800000,0.000000,0.000000,0.000000,1.000000,-0.714285714',
  'spin:40.500000,0.000000,619.000000,1.000000,0.000000,0.000000,3.000000000',
  'fixed:case',
]);

/** Crank angles in degrees: every 30 across the 720 degree cycle, which includes the lesson's 0, 90, 180, 360, 540, 630 and 720. */
export const FINGERPRINT_ANGLES = Object.freeze(Array.from({ length: 25 }, (_, index) => index * 30));

const VARIANTS = Object.freeze([{ mirrorX: false }, { mirrorX: true }]);

/** A matrix element to the nanometre, with no negative zero, as text. */
const element = (value) => String(Number(value.toFixed(9)) + 0);

/**
 * @param {{ parameters?: Record<string, number> }} [options]  Evaluator parameters to fingerprint instead of the defaults (a test of sensitivity).
 * @returns {{ motion_api_version: string, algorithm: 'sha256', bodies: number, angles: number, variants: number, fingerprint: string }}
 */
export function motionFingerprint({ parameters = {} } = {}) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ bodies: FINGERPRINT_BODIES, angles: FINGERPRINT_ANGLES, variants: VARIANTS }));
  for (const variant of VARIANTS) {
    const evaluate = createGtsioBodyEvaluator(parameters, variant);
    for (const body of FINGERPRINT_BODIES) {
      for (const angle of FINGERPRINT_ANGLES) hash.update(`${variant.mirrorX ? 'M' : 'P'}|${body}|${angle}|${evaluate(body, angle).elements.map(element).join(',')}\n`);
    }
  }
  return {
    motion_api_version: MOTION_API_VERSION,
    algorithm: 'sha256',
    bodies: FINGERPRINT_BODIES.length,
    angles: FINGERPRINT_ANGLES.length,
    variants: VARIANTS.length,
    fingerprint: hash.digest('hex'),
  };
}
