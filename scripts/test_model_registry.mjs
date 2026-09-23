import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODEL_REGISTRY_SCHEMA, MODEL_CAPABILITY_FLAGS, validateModelRegistry } from '../web/schema/content-schema.mjs';

const registry=JSON.parse(fs.readFileSync(new URL('../web/models.json',import.meta.url),'utf8'));
assert.equal(registry.schema,MODEL_REGISTRY_SCHEMA);
assert.deepEqual(registry.models.map(model=>model.id),['cylinder','gtsio520-h-v5-teaching-engine']);
assert.equal(new Set(registry.models.map(model=>model.adapter)).size,2);
assert.ok(registry.models.every(model=>model.title&&model.kicker&&model.description));
const cylinder=registry.models.find(model=>model.id==='cylinder');
assert.deepEqual([cylinder.asset_url,cylinder.asset_fallback_url,cylinder.component_catalogue_url,cylinder.motion_profile_url],['./control.glb.gz?v=20260912-lesson-ready','./control.glb?v=20260912-lesson-ready','./components.json','./motion.json?v=20260912-operating-cylinder']);
assert.equal(cylinder.component_tree_url,'./component-tree.json');

// Published GLBs are not in git: the live site can only load a model that names its Drive files.
const driveId=/^[-\w]{20,}$/;
assert.match(cylinder.asset_drive_id,driveId);
assert.match(cylinder.asset_fallback_drive_id,driveId);
const transport=JSON.parse(fs.readFileSync(new URL('../web/engine-contract.json',import.meta.url),'utf8')).asset.transport;
assert.match(transport.drive_file_id,driveId);
assert.match(transport.fallback_drive_file_id,driveId);
const config=JSON.parse(fs.readFileSync(new URL('../web/config.json',import.meta.url),'utf8'));
assert.ok(config.drive_api_key,'the restricted Drive browser key must be configured for published model delivery');

assert.deepEqual(validateModelRegistry(registry),[]);
for (const model of registry.models) {
  for (const flag of MODEL_CAPABILITY_FLAGS) assert.equal(typeof model[flag],'boolean',`${model.id}.${flag} should be a capability flag`);
}
console.log('training model registry is valid');
