import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = JSON.parse(fs.readFileSync(new URL('../web/engine-contract.json', import.meta.url), 'utf8'));
const patterns = contract.operation.motion_selector.any_regex.map((pattern) => new RegExp(pattern, 'i'));
const isInMotionScope = (trackName) => patterns.some((pattern) => pattern.test(trackName.replaceAll('_', ' ')));

for (const trackName of [
  'RUN | V3 02 Crankshaft.position',
  'RUN | V3 04 Camshaft.quaternion',
  'RUN | V3 25 Propeller shaft.scale',
  'C1 | EXT Piston.position',
  'C6 | EXT Rod | small end.quaternion',
  'C3_|_EXT_Piston_|_ring_1.position',
]) assert.equal(isInMotionScope(trackName), true, `${trackName} should move`);

for (const trackName of [
  'V5 Left crankcase half.position',
  'V5 Right hollow crankcase casting.position',
  'C1 | EXT | steel barrel.position',
  'C4 | EXT | aluminium head.position',
  'V5_Right_crankcase_half.position',
]) assert.equal(isInMotionScope(trackName), false, `${trackName} must remain structural`);

console.log('full-engine animation scope keeps structural crankcase and cylinders fixed');
