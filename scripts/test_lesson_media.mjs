import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lessonArtifactIds } from '../src/components/lessonArtifactIds.ts';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson('web/lessons-manifest.json');
const packs = manifest.packs.map((path) => ({ path, ...readJson(`web/${path.replace(/^\.\//, '')}`) }));
const artifacts = new Set(lessonArtifactIds);
const attribution = readJson('web/lesson-media/attribution.json');
const figureSources = readJson('web/lesson-media/figure-sources.json');
const artifactSource = readFileSync('src/components/LessonArtifacts.tsx', 'utf8');

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
        const file = step.url.slice('./lesson-media/'.length);
        assert.ok(attribution[file], `${lesson.id}/${step.title}: ${file} has no entry in lesson-media/attribution.json, so the Credits page cannot credit it`);
        assert.match(step.credit || '', /\S/, `${lesson.id}/${step.title} needs a credit line`);
        assert.match(step.license || '', /\S/, `${lesson.id}/${step.title} needs a licence line`);
      }
    }
  }
}

// Every artifact the packs may name has a component behind it, and none is registered without one.
for (const id of artifacts) assert.ok(artifactSource.includes(`id === '${id}'`), `artifact '${id}' is listed but LessonArtifacts.tsx does not render it`);

// Every figure built from a manual page is recorded with where it came from, and is credited.
for (const [id, spec] of Object.entries(figureSources)) {
  assert.ok(existsSync(resolve('web/lesson-media', `${id}.webp`)), `figure-sources.json lists ${id}, but its image has not been built`);
  assert.ok(attribution[`${id}.webp`], `${id} is built from a manual but has no credit in attribution.json`);
  assert.ok(spec.pdf && Number.isInteger(spec.page) && spec.box?.length === 4, `${id}: needs a pdf, a page and a crop box`);
}

console.log('lesson media references and native artifacts are publishable');
