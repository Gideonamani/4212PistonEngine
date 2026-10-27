// Regenerate src/viewer/core/motion-fingerprint.json after a deliberate change to the procedural motion.
//
//   node scripts/write_motion_fingerprint.mjs
//
// Run it only when a pose was meant to change, and then also bump MOTION_API_VERSION if the meaning of a pose changed, and ask for the MEDIS
// audits that depend on the motion to be rerun (docs/decisions/002-motion-interface-and-release-envelope.md). Do not run it to make a failing
// test pass without knowing why the poses changed.
import fs from 'node:fs';
import { motionFingerprint } from '../src/viewer/core/motion-fingerprint.mjs';

const target = new URL('../src/viewer/core/motion-fingerprint.json', import.meta.url);
const value = motionFingerprint();
fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
console.log(`${target.pathname}\n${JSON.stringify(value)}`);
