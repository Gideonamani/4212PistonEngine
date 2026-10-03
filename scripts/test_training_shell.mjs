import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = path => fs.existsSync(new URL(`../${path}`, import.meta.url));
const exploreViewer = read('src/viewer/ExploreViewer.tsx');
const lessonViewer = read('src/viewer/LessonViewer.tsx');
const viewerParts = read('src/viewer/ViewerParts.tsx');
const viewerHook = read('src/viewer/useModelViewer.ts');
const runtime = read('src/viewer/core/runtime.ts');
const adapters = read('src/viewer/adapters/index.ts');
const explore = read('src/components/ExploreView.tsx');
const lessonMedia = read('src/components/LessonMedia.tsx');
const controls = read('src/viewer/ExploreControls.tsx');
const engineAdapter = read('src/viewer/adapters/fullEngineAdapter.ts');

// Explore and lessons open the shared viewer pieces instead of embedding separate pages.
assert.match(explore, /<ExploreViewer[\s\S]*modelId=\{modelId\}/);
assert.match(explore, /requestFullscreen/);
assert.match(explore, /fullscreenchange/);
assert.match(explore, /onToggleFullPage/);
assert.doesNotMatch(explore, /iframe|explore\.html/);
assert.match(lessonMedia, /<LessonViewer/);
assert.match(lessonMedia, /<ExploreViewer[\s\S]*embedded/);
assert.match(lessonMedia, /viewFromStep\(step\)/);
assert.match(lessonViewer, /lessonProfile/);
assert.doesNotMatch(lessonViewer + exploreViewer, /\bModelViewer\b/, 'the single catch-all ModelViewer stays retired');
assert.equal(exists('src/viewer/ModelViewer.tsx'), false);

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
for (const feature of ['components','motion','section','appearance']) {
  assert.match(exploreViewer,new RegExp(`features\\?\\.${feature}|features\\.${feature}`));
}
assert.match(viewerParts,/features\?\.hotspots/);
assert.match(exploreViewer,/hasControlPanels/);
assert.match(exploreViewer,/'explore'/);
assert.match(viewerParts,/Home/);
assert.match(viewerParts,/offsetAfterKey/);
assert.match(exploreViewer,/ExploreControls/);
assert.match(exploreViewer,/CompactMotionPlayer/);
assert.match(exploreViewer,/4212-explore-show-player/);
assert.match(viewerHook,/createViewerRuntime/);
assert.match(viewerHook,/createModelSession/);
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
