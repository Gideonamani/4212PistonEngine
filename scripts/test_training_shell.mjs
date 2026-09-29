import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = path => fs.existsSync(new URL(`../${path}`, import.meta.url));
const viewer = read('src/viewer/ModelViewer.tsx');
const runtime = read('src/viewer/core/runtime.ts');
const adapters = read('src/viewer/adapters/index.ts');
const explore = read('src/components/ExploreView.tsx');
const lessonMedia = read('src/components/LessonMedia.tsx');
const controls = read('src/viewer/ExploreControls.tsx');
const engineAdapter = read('src/viewer/adapters/fullEngineAdapter.ts');

// Explore and lessons select a viewer profile instead of embedding separate pages.
assert.match(explore, /<ModelViewer[\s\S]*modelId=\{modelId\}[\s\S]*profile="explore"/);
assert.match(explore, /requestFullscreen/);
assert.match(explore, /fullscreenchange/);
assert.match(explore, /onToggleFullPage/);
assert.doesNotMatch(explore, /iframe|explore\.html/);
assert.match(lessonMedia, /<ModelViewer/);
assert.match(lessonMedia, /lesson-reference/);
assert.match(lessonMedia, /lesson-dynamic/);
assert.match(lessonMedia, /initialAngle=\{typeof step\.action\?\.value/);
assert.match(lessonMedia, /focusHotspots/);

// The runtime owns scene infrastructure; adapters attach model-specific behaviour.
assert.match(runtime, /new THREE\.WebGLRenderer/);
assert.match(runtime, /new THREE\.PerspectiveCamera/);
assert.match(runtime, /new OrbitControls/);
assert.match(runtime, /ResizeObserver/);
assert.match(runtime, /renderer\.dispose\(\)/);
assert.match(adapters, /createStaticGltfSession/);
assert.match(adapters, /createCylinderSession/);
assert.match(adapters, /createFullEngineSession/);
assert.equal((runtime.match(/new THREE\.WebGLRenderer/g)||[]).length,1);

// Capability panels disappear for a static model without a separate component.
for (const feature of ['components','motion','section','appearance','hotspots']) {
  assert.match(viewer,new RegExp(`features\\?\\.${feature}|features\\.${feature}`));
}
assert.match(viewer,/hasControlPanels/);
assert.match(viewer,/profile === 'explore'/);
assert.match(viewer,/ArrowLeft/);
assert.match(viewer,/Home/);
assert.match(viewer,/ExploreControls/);
assert.match(viewer,/CompactMotionPlayer/);
assert.match(viewer,/4212-explore-show-player/);
assert.match(controls,/lg:w-80/);
assert.match(controls,/lg:border-l/);

// Full-engine playback is contract-scoped so static casing cannot receive baked export tracks.
assert.match(engineAdapter,/contract\.operation\.motion_selector/);
assert.match(engineAdapter,/filter\(\(track\) => trackMatchesSelector/);

// Legacy entry points and duplicate viewer/controller implementations stay retired.
for (const path of [
  'web/index.html','web/explore.html','web/learn.html','web/check.html','web/engine.html',
  'web/viewer.js','web/engine-core.mjs','web/engine-training-adapter.mjs',
  'src/components/ReferenceModelViewer.tsx','src/data/referenceModels.ts',
]) assert.equal(exists(path),false,`${path} should not return after the React migration`);

console.log('unified React viewer architecture is wired and legacy shells are absent');
