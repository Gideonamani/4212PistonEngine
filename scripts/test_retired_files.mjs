import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Files and entry points that were retired during the React migration stay gone, so a merge or a restored backup cannot quietly
// bring a second viewer or an old page back. The browser tests in e2e/ cover what the app does; this only checks what must not exist.
const RETIRED = [
  'web/index.html', 'web/explore.html', 'web/learn.html', 'web/check.html', 'web/engine.html',
  'web/viewer.js', 'web/engine-core.mjs', 'web/engine-training-adapter.mjs',
  'src/components/ReferenceModelViewer.tsx', 'src/data/referenceModels.ts',
  'src/viewer/ModelViewer.tsx',
];

for (const path of RETIRED) {
  test(`${path} stays retired`, () => {
    assert.equal(fs.existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} should not return after the React migration`);
  });
}
