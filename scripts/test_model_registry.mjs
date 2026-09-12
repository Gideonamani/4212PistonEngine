import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync(new URL('../web/models.json',import.meta.url),'utf8'));
assert.equal(registry.schema,'4212.training-model-registry/v1');
assert.deepEqual(registry.models.map(model=>model.id),['cylinder','gtsio520-h-v5-teaching-engine']);
assert.equal(new Set(registry.models.map(model=>model.adapter)).size,2);
assert.ok(registry.models.every(model=>model.title&&model.kicker&&model.description));
const cylinder=registry.models.find(model=>model.id==='cylinder');
assert.deepEqual([cylinder.asset_url,cylinder.asset_fallback_url,cylinder.component_catalogue_url,cylinder.motion_profile_url],['./control.glb.gz?v=20260912-lesson-ready','./control.glb?v=20260912-lesson-ready','./components.json','./motion.json?v=20260912-operating-cylinder']);
console.log('training model registry is valid');
