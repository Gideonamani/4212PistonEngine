import assert from 'node:assert/strict';
import fs from 'node:fs';
const registry=JSON.parse(fs.readFileSync(new URL('../src/data/models.json',import.meta.url),'utf8'));

assert.deepEqual(registry.map(model=>model.id),['cylinder','gtsio520-h-v5-teaching-engine','wright-1903-engine','wright-1903-reconstruction','langley-manly-balzer-1903','hydraulic-tappet','oil-pump','accessory-drives']);
assert.deepEqual(registry.map(model=>model.adapter),['operating-cylinder','full-engine','static-gltf','animated-study','animated-study','animated-study','animated-study','animated-study']);
assert.equal(new Set(registry.map(model=>model.id)).size,registry.length,'model ids must be unique');
assert.ok(registry.every(model=>model.label&&model.eyebrow&&model.description));
assert.ok(registry.every(model=>!('imageType' in model)),'card pictures come from previewUrl, not a guessed illustration type');
assert.ok(registry.every(model=>Array.isArray(model.badges)&&model.badges.length));

const cylinder=registry.find(model=>model.id==='cylinder');
assert.deepEqual(cylinder.sources.map(source=>source.localUrl),['./cylinder-reviewed-20261001.glb.gz']);
assert.equal(cylinder.componentCatalogueUrl,'./components.json?v=20261001-reviewed');
assert.equal(cylinder.motionProfileUrl,'./motion.json?v=20261001-reviewed');
assert.equal(cylinder.sources[0].compressed,true);
assert.ok(fs.statSync(new URL('../web/cylinder-reviewed-20261001.glb.gz',import.meta.url)).size>0,'restore the reviewed cylinder from Drive before asset validation');

const engine=registry.find(model=>model.id==='gtsio520-h-v5-teaching-engine');
assert.equal(engine.contractUrl,'./engine-contract.json');

const wright=registry.find(model=>model.id==='wright-1903-engine');
assert.equal(wright.adapter,'static-gltf');
assert.equal(wright.sources[0].localUrl,'./wright-1903-engine.glb?v=20260929-smithsonian-medium');
assert.equal(wright.license,'CC0');
assert.deepEqual(wright.lessonHotspotIds,['magneto','valve','crankcase']);
assert.equal(wright.hotspots.length,6);
assert.ok(wright.lessonHotspotIds.every(id=>wright.hotspots.some(hotspot=>hotspot.id===id)));
assert.ok(fs.statSync(new URL('../web/wright-1903-engine.glb',import.meta.url)).size>1_000_000,'restore the compact reference GLB from Drive before asset validation');

const reconstruction=registry.find(model=>model.id==='wright-1903-reconstruction');
assert.match(reconstruction.sources[0].localUrl,/^\.\/wright-1903-reconstruction\.glb\.gz\?v=[0-9a-f]{12}$/);
assert.match(reconstruction.contractUrl,/^\.\/wright-1903-reconstruction-contract\.json\?v=[0-9a-f]{12}$/);
assert.ok(!('hotspots' in reconstruction),'the second Wright card is the modelled study; the scan card keeps the hotspots');
assert.notEqual(reconstruction.sources[0].driveId,wright.sources[0].driveId,'the modelled study is its own Drive file');
assert.ok(fs.statSync(new URL('../web/wright-1903-reconstruction.glb.gz',import.meta.url)).size>1_000_000,'restore the Wright reconstruction from Drive before asset validation');

const langley=registry.find(model=>model.id==='langley-manly-balzer-1903');
assert.match(langley.sources[0].localUrl,/^\.\/langley-manly-balzer-1903\.glb\.gz\?v=[0-9a-f]{12}$/);
assert.match(langley.contractUrl,/^\.\/langley-manly-balzer-1903-contract\.json\?v=[0-9a-f]{12}$/);
assert.notEqual(langley.sources[0].driveId,reconstruction.sources[0].driveId,'the Langley study is its own Drive file');
assert.ok(fs.statSync(new URL('../web/langley-manly-balzer-1903.glb.gz',import.meta.url)).size>1_000_000,'restore the Langley reconstruction from Drive before asset validation');

const driveId=/^[-\w]{20,}$/;
for (const source of wright.sources) assert.match(source.driveId,driveId);
for (const model of registry.filter(model=>model.sources)) {
  for (const source of model.sources) assert.match(source.driveId,driveId,'published models must have Drive delivery');
}
const transport=JSON.parse(fs.readFileSync(new URL('../web/engine-contract.json',import.meta.url),'utf8')).asset.transport;
assert.match(transport.drive_file_id,driveId);
assert.match(transport.fallback_drive_file_id,driveId);
const config=JSON.parse(fs.readFileSync(new URL('../web/config.json',import.meta.url),'utf8'));
assert.ok(config.drive_api_key,'the restricted Drive browser key must be configured for published model delivery');

console.log('unified 3D model registry is valid');
