import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { MAX_NORMAL_ERROR_DEGREES, MAX_POSITION_ERROR, MAX_ROTATION_ERROR_DEGREES, MAX_TRANSLATION_ERROR } from './optimize_model.mjs';
import { MAX_DIFFERING_PIXELS, MAX_MEAN_DIFFERENCE } from './compare_model_renders.mjs';
import { MODELS, RELEASE } from './build_optimized_models.mjs';

// The record of the optimised models (releases/model-optimization-opt1.json) is what a later session binds from, so it has to be complete,
// and it has to say the optimisation stayed inside its limits. The model files themselves are not in git; when they are present locally
// (restored or built), their size and hash must match the record.

const record = JSON.parse(fs.readFileSync(`releases/model-optimization-${RELEASE}.json`, 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('the record covers every model once, under the file names the build script writes', () => {
  assert.equal(record.schema, '4212.model-optimization/v1');
  assert.deepEqual(record.models.map((model) => model.id), MODELS.map((model) => model.id));
  for (const model of MODELS) {
    const entry = record.models.find((item) => item.id === model.id);
    assert.equal(entry.source.file, model.source, model.id);
    assert.equal(entry.optimized.file, model.output, model.id);
    assert.match(entry.optimized.file, new RegExp(`-${RELEASE}\\.glb\\.gz$`), `${model.id} is a new file name, so the current release is never replaced`);
    assert.notEqual(entry.optimized.file, entry.source.file);
    assert.equal(entry.optimized.fallbackFile, model.fallback, `${model.id} fallback`);
  }
});

test('every model kept its surface, drew the same, and stayed inside the error limits', () => {
  for (const entry of record.models) {
    const label = entry.id;
    assert.equal(entry.roundTripExact, true, `${label}: the packed file decodes to what was packed`);
    assert.equal(entry.changes.trianglesUnchanged, true, `${label}: triangles`);
    assert.equal(entry.changes.sharedDataUnchanged, true, `${label}: sharing identical data`);
    assert.ok(entry.measuredError.positionRelativeToModel <= MAX_POSITION_ERROR, `${label}: positions`);
    assert.ok(entry.measuredError.normalDegrees <= MAX_NORMAL_ERROR_DEGREES, `${label}: normals`);
    assert.ok(entry.measuredError.animationTranslationRelativeToModel <= MAX_TRANSLATION_ERROR, `${label}: animated translation`);
    assert.ok(entry.measuredError.animationRotationDegrees <= MAX_ROTATION_ERROR_DEGREES, `${label}: animated rotation`);
    assert.ok(entry.renderCheck, `${label}: render check recorded`);
    assert.equal(entry.renderCheck.passed, true, `${label}: render check passed`);
    assert.ok(entry.renderCheck.worstDifferingPixels <= MAX_DIFFERING_PIXELS && entry.renderCheck.worstMeanDifference <= MAX_MEAN_DIFFERENCE, `${label}: render difference`);
    assert.ok(entry.renderCheck.pictures >= 9, `${label}: enough pictures compared`);
  }
});

test('every model is smaller to download and to hold in memory', () => {
  for (const entry of record.models) {
    assert.ok(entry.optimized.transferBytes < entry.source.transferBytes, `${entry.id}: transfer`);
    assert.ok(entry.optimized.decodedBytes < entry.source.decodedBytes, `${entry.id}: decoded`);
    assert.equal(entry.saving.transferPercent, Number(((1 - entry.optimized.transferBytes / entry.source.transferBytes) * 100).toFixed(1)), `${entry.id}: recorded saving`);
  }
  const before = record.models.reduce((sum, entry) => sum + entry.source.transferBytes, 0);
  const after = record.models.reduce((sum, entry) => sum + entry.optimized.transferBytes, 0);
  assert.ok(after < before * 0.75, `all models together: ${before} -> ${after}`);
});

test('hashes are recorded, and any Drive id is a plain id (null until the file is published)', () => {
  for (const entry of record.models) {
    for (const hash of [entry.source.transferSha256, entry.source.decodedSha256, entry.optimized.transferSha256, entry.optimized.decodedSha256]) assert.match(hash, /^[0-9a-f]{64}$/, entry.id);
    for (const id of [entry.optimized.driveId, entry.optimized.fallbackDriveId]) assert.ok(id === null || id === undefined || /^[\w-]{20,}$/.test(id), `${entry.id}: drive id`);
  }
});

test('a model file that is present locally is exactly the one the record describes', (context) => {
  const present = record.models.filter((entry) => fs.existsSync(`web/${entry.optimized.file}`));
  if (!present.length) return context.skip('no optimised model files are built or restored here');
  for (const entry of present) {
    assert.equal(fs.statSync(`web/${entry.optimized.file}`).size, entry.optimized.transferBytes, `${entry.id}: size`);
    assert.equal(sha256(`web/${entry.optimized.file}`), entry.optimized.transferSha256, `${entry.id}: hash`);
  }
});
