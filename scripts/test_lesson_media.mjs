import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packs = ['web/history-lessons.json', 'web/fundamentals-lessons.json'].map((path) => JSON.parse(readFileSync(path, 'utf8')));
const artifacts = new Set([
  'cycle-phase-scrubber', 'two-stroke-port-timing', 'arrangement-comparator', 'ignition-method-comparator',
  'air-cooling-path-explorer', 'turbocharger-energy-path', 'aspiration-altitude-comparator',
  'steam-engine-schematic', 'otto-cycle-overview', 'piston-crank-converter', 'arrangement-inline', 'arrangement-v',
  'swept-volume-diagram', 'engine-data-comparison', 'otto-pv-diagram', 'otto-pv-ideal-vs-practical', 'diesel-otto-pv-compare', 'valve-timing-diagram', 'construction-comparison', 'cylinder-numbering', 'cylinder-firing-order',
]);

for (const pack of packs) {
  for (const lesson of pack.lessons) {
    for (const step of lesson.steps) {
      if (!step.url) continue;
      assert.ok(!step.url.startsWith('PLACEHOLDER:'), `${lesson.id}/${step.title} still uses a placeholder`);
      if (step.url.startsWith('artifact:')) {
        assert.ok(artifacts.has(step.url.slice('artifact:'.length)), `${lesson.id}/${step.title} references an unknown artifact`);
      }
      if (step.url.startsWith('./lesson-media/')) {
        assert.ok(existsSync(resolve('web', step.url.slice(2))), `${lesson.id}/${step.title} references a missing media file`);
        assert.match(step.alt || '', /\S/, `${lesson.id}/${step.title} needs accessible alt text`);
      }
    }
  }
}

console.log('lesson media references and native artifacts are publishable');
