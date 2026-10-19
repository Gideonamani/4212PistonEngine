import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import zlib from 'node:zlib';
import { MAX_NORMAL_ERROR_DEGREES, MAX_POSITION_ERROR } from './optimize_model.mjs';
import { MAX_DIFFERING_PIXELS, MAX_MEAN_DIFFERENCE } from './compare_model_renders.mjs';
import { BUDGET_TRANSFER_BYTES, R10_MODEL, R10_OPTIONS, R10_RECORD } from './build_gtsio_r10_optimized.mjs';
import { PLACEHOLDER_DRIVE_ID } from './bind_gtsio_r10_optimized.mjs';

// The optimised GTSIO-520-H R10 file (releases/model-optimization-gtsio520-r10.json): it has to stay inside the phone budget and the optimiser's
// error limits, the render check has to have been made, and the contract, registry and Drive manifest must all describe the same file. The model
// file itself is not in git; when it is present locally (built or restored) its size and hash must match the record.

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const record = read(R10_RECORD);
const [entry] = record.models;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const contract = read('web/gtsio520-r10-contract.json');
const registry = read('src/data/models.json').find((model) => model.id === R10_MODEL.id);
const manifest = read('docs/drive-asset-manifest.json');

test('the record is about the R10 file under the name the build script writes, and stays inside the phone budget', () => {
  assert.equal(record.schema, '4212.model-optimization/v1');
  assert.equal(record.models.length, 1);
  assert.equal(entry.id, R10_MODEL.id);
  assert.equal(entry.source.file, R10_MODEL.source);
  assert.equal(entry.optimized.file, R10_MODEL.output);
  assert.match(entry.optimized.file, /-opt1\.glb\.gz$/, 'a new file name, so the current release is never replaced');
  assert.ok(entry.optimized.transferBytes <= BUDGET_TRANSFER_BYTES, `transfer ${entry.optimized.transferBytes} is over the ${BUDGET_TRANSFER_BYTES}-byte budget`);
  assert.ok(entry.optimized.transferBytes < entry.source.transferBytes && entry.optimized.decodedBytes < entry.source.decodedBytes);
  assert.equal(entry.saving.transferPercent, Number(((1 - entry.optimized.transferBytes / entry.source.transferBytes) * 100).toFixed(1)));
  assert.equal(entry.settings.positionMantissaBits, R10_OPTIONS.positionMantissaBits);
});

test('the optimiser kept the surface and stayed inside its error limits, and the render check was made', () => {
  assert.equal(entry.roundTripExact, true);
  assert.equal(entry.changes.trianglesUnchanged, true);
  assert.equal(entry.changes.triangles, 2_080_106, 'every triangle of the 1,396 parts is kept');
  assert.equal(entry.changes.sharedDataUnchanged, true);
  assert.ok(entry.measuredError.positionRelativeToModel <= MAX_POSITION_ERROR);
  assert.ok(entry.measuredError.normalDegrees <= MAX_NORMAL_ERROR_DEGREES);
  assert.ok(entry.renderCheck, 'run scripts/compare_model_renders.mjs with --record');
  assert.equal(entry.renderCheck.passed, true);
  assert.ok(entry.renderCheck.worstDifferingPixels <= MAX_DIFFERING_PIXELS && entry.renderCheck.worstMeanDifference <= MAX_MEAN_DIFFERENCE);
  assert.ok(entry.renderCheck.pictures >= 9);
  assert.ok(entry.parseTime.originalMs > 0 && entry.parseTime.optimisedMs > 0, 'parse time recorded');
});

test('hashes are plain hex, and the Drive id is a plain id (null in the record until the file is published)', () => {
  for (const hash of [entry.source.transferSha256, entry.source.decodedSha256, entry.optimized.transferSha256, entry.optimized.decodedSha256]) assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(entry.optimized.driveId === null || /^[\w-]{20,}$/.test(entry.optimized.driveId));
});

test('the contract, the registry and the Drive manifest describe the optimised file', () => {
  assert.equal(contract.asset_sha256, entry.optimized.decodedSha256);
  assert.equal(contract.bytes, entry.optimized.decodedBytes);
  assert.equal(contract.gzip_bytes, entry.optimized.transferBytes);
  const [source] = registry.sources;
  assert.equal(source.localUrl, `./${entry.optimized.file}`);
  assert.equal(source.transferBytes, entry.optimized.transferBytes);
  assert.equal(source.decodedBytes, entry.optimized.decodedBytes);
  assert.equal(registry.contractUrl, `./gtsio520-r10-contract.json?v=${entry.optimized.decodedSha256.slice(0, 12)}`);
  const asset = manifest.web_assets.find((item) => item.path === `web/${entry.optimized.file}`);
  assert.ok(asset, 'the optimised file is a Drive-hosted web asset');
  assert.equal(asset.bytes, entry.optimized.transferBytes);
  assert.equal(asset.sha256, entry.optimized.transferSha256);
  assert.equal(asset.drive_id, source.driveId, 'the registry and the manifest name the same Drive file');
  assert.ok(!manifest.web_assets.some((item) => item.path === `web/${R10_MODEL.source}`), 'the unoptimised file is no longer a current asset');
  assert.ok(manifest.previous_web_releases.some((item) => item.path === `web/${R10_MODEL.source}` && item.retained_reason), 'and it stays on record for rollback');
});

test('a published Drive id is real: the placeholder may only appear while the file is not uploaded', (context) => {
  const driveId = registry.sources[0].driveId;
  if (driveId === PLACEHOLDER_DRIVE_ID) return context.skip('the optimised file is not on Drive yet; the pull request must not merge');
  assert.match(driveId, /^[\w-]{20,}$/);
  assert.equal(entry.optimized.driveId, driveId, 'the record names the Drive file the registry uses');
});

test('a model file that is present locally is exactly the one the record describes', (context) => {
  const file = `web/${entry.optimized.file}`;
  if (!fs.existsSync(file)) return context.skip('the optimised file is not built or restored here');
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, entry.optimized.transferBytes);
  assert.equal(sha256(bytes), entry.optimized.transferSha256);
  const decoded = zlib.gunzipSync(bytes);
  assert.equal(decoded.length, entry.optimized.decodedBytes);
  assert.equal(sha256(decoded), entry.optimized.decodedSha256);
});
