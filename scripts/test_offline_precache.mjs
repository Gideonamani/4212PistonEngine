import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { MEDIA_FOLDERS, cacheVersion, precachePlan } from './offline/precache-plan.mjs';

// What the service worker keeps on the device (issue #77): the app and lesson data at install, lesson pictures and audio on demand, and
// never a model file. The worker itself is checked in the browser by e2e/production.spec.ts.

test('the app, the lesson data and the small pictures are saved at install; lesson pictures and audio on demand', () => {
  const { core, media } = precachePlan([
    'index.html', 'assets/index-abc.js', 'assets/index-abc.css', 'lessons-manifest.json', 'fundamentals-lessons.json', 'config.json',
    'schema/content-schema.mjs', 'thumbnails/course-x.webp', 'icons/icon-192.png', 'manifest.webmanifest',
    'lesson-media/fig-1.webp', 'audio/step-2.mp3',
  ]);
  assert.deepEqual(media, ['audio/step-2.mp3', 'lesson-media/fig-1.webp']);
  assert.ok(core.includes('index.html') && core.includes('assets/index-abc.js') && core.includes('config.json') && core.includes('icons/icon-192.png'));
  assert.equal(core.length, 10);
  assert.deepEqual([...MEDIA_FOLDERS], ['lesson-media/', 'audio/']);
});

test('model and CAD files, source maps and the worker itself are never saved', () => {
  const { core, media } = precachePlan(['index.html', 'sw.js', 'assets/index.js.map', 'engine.glb.gz', 'cylinder.glb', 'part.STEP', 'lesson-media/model.glb', '.nojekyll']);
  assert.deepEqual(core, ['index.html']);
  assert.deepEqual(media, []);
});

test('a build without a page is refused, and a listed file appears once', () => {
  assert.throws(() => precachePlan(['assets/index.js']), /no index\.html/);
  assert.deepEqual(precachePlan(['index.html', 'index.html']).core, ['index.html']);
});

test('the saved copy is renamed when any file changes, and only then', () => {
  const build = [['index.html', 'aa'], ['assets/index.js', 'bb']];
  assert.equal(cacheVersion(build), cacheVersion([...build].reverse()), 'the order files are listed in does not matter');
  assert.notEqual(cacheVersion(build), cacheVersion([['index.html', 'aa'], ['assets/index.js', 'bc']]), 'a changed file');
  assert.notEqual(cacheVersion(build), cacheVersion([...build, ['config.json', 'cc']]), 'an added file');
  assert.match(cacheVersion(build), /^[0-9a-z]+$/);
});

test('the build writes the worker after pruning the models, so it lists only what is deployed', () => {
  const build = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.build;
  assert.match(build, /prune_deployed_models\.mjs && node scripts\/build_service_worker\.mjs/);
});
