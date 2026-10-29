import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DIRECTIONAL_LIGHTS, ENVIRONMENT_INTENSITY, EXPOSURE, HEMISPHERE_LIGHT, exposureFor } from '../src/viewer/core/lighting.mjs';

// The viewer's lighting rig. How it looks is judged on the real models; these hold the relations that keep it from drifting back to the old
// one, which was about twice as bright as a surface's own colour asks for and washed every pale part out to white.

const chroma = (hex) => { const [r, g, b] = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; return Math.max(r, g, b) - Math.min(r, g, b); };

test('the key light does most of the lighting, so a part has a bright side and a shaded side', () => {
  const [key, ...others] = DIRECTIONAL_LIGHTS;
  assert.equal(key.name, 'key');
  for (const other of others) assert.ok(key.intensity >= 2 * other.intensity, `the key is at least twice the ${other.name}`);
});

test('ambient light is a minor part of the whole, or the picture goes flat and pale', () => {
  const ambient = ENVIRONMENT_INTENSITY + HEMISPHERE_LIGHT.intensity;
  const directional = DIRECTIONAL_LIGHTS.reduce((sum, light) => sum + light.intensity, 0);
  assert.ok(ambient > 0, 'a metal still has an environment to reflect');
  assert.ok(ambient <= 0.4 * directional, `ambient ${ambient.toFixed(2)} against directional ${directional.toFixed(2)}`);
  // The old rig: environment 1 (unscaled), hemisphere 0.85, directional 3.85.
  assert.ok(ambient + directional < 1 + 0.85 + 3.85, 'the whole rig is dimmer than the old one');
});

test('the key is white, so a part is not tinted where it is lit', () => {
  assert.ok(chroma(DIRECTIONAL_LIGHTS[0].color) <= 8, 'the key has no colour cast to speak of');
});

test('the light stage gets less exposure than the dark one: a part must be darker than its pale background to stand out of it', () => {
  assert.ok(EXPOSURE.light < EXPOSURE.dark);
  assert.ok(EXPOSURE.neutral <= EXPOSURE.dark && EXPOSURE.neutral >= EXPOSURE.light, 'a picture on no stage sits between the two');
  for (const value of Object.values(EXPOSURE)) assert.ok(value > 0 && value <= 1.2, 'no exposure above what the rig was judged at');
});

test('exposureFor names the right stage and falls back to the dark one', () => {
  assert.equal(exposureFor('light'), EXPOSURE.light);
  assert.equal(exposureFor('dark'), EXPOSURE.dark);
  assert.equal(exposureFor('neutral'), EXPOSURE.neutral);
  assert.equal(exposureFor(undefined), EXPOSURE.dark);
  assert.equal(exposureFor('sepia'), EXPOSURE.dark);
});

test('the runtime builds its rig from these numbers, and follows the theme', () => {
  const runtime = fs.readFileSync('src/viewer/core/runtime.ts', 'utf8');
  for (const name of ['DIRECTIONAL_LIGHTS', 'ENVIRONMENT_INTENSITY', 'HEMISPHERE_LIGHT', 'exposureFor']) assert.ok(runtime.includes(name), `runtime.ts uses ${name}`);
  assert.match(runtime, /renderer\.toneMapping = THREE\.NeutralToneMapping/, 'tone mapping that keeps a colour as authored');
  assert.match(runtime, /renderer\.toneMappingExposure = exposureFor\(theme\(\)\);\s*\n\s*for \(const listener/, 'a theme change sets the exposure');
});
