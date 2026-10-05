// Builds the optimised release of every teaching model and writes its record.
//
//   node scripts/build_optimized_models.mjs [--only cylinder oil-pump ...] [--into web] [--record releases/model-optimization-opt1.json]
//
// Reads each model's current published file from web/ (restore them with scripts/fetch_drive_assets.py on a fresh checkout), runs
// scripts/optimize_model.mjs on it and writes the result beside it under a NEW file name (suffix -opt1), so the current release is never
// replaced. The record lists, for every model, the source and the new file with sizes and SHA-256 hashes, what the optimiser changed and
// the largest error it measured. Drive ids stay null until the new files are uploaded and published (see docs/model-optimization.md).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { optimizeModel } from './optimize_model.mjs';

export const RELEASE = 'opt1';

/** Each model: where its current file is, and the names of the new ones. `fallback` is a plain GLB for browsers that cannot unpack gzip. */
export const MODELS = [
  { id: 'cylinder', source: 'cylinder-reviewed-20261001.glb.gz', output: `cylinder-reviewed-20261001-${RELEASE}.glb.gz` },
  { id: 'hydraulic-tappet', source: 'hydraulic-tappet.glb.gz', output: `hydraulic-tappet-${RELEASE}.glb.gz` },
  { id: 'oil-pump', source: 'oil-pump.glb.gz', output: `oil-pump-${RELEASE}.glb.gz` },
  { id: 'accessory-drives', source: 'accessory-drives.glb.gz', output: `accessory-drives-${RELEASE}.glb.gz` },
  { id: 'gtsio520-h-v5-teaching-engine', source: 'engine.glb.gz', output: `engine-${RELEASE}.glb.gz`, fallback: `engine-${RELEASE}.glb` },
  { id: 'wright-1903-engine', source: 'wright-1903-engine.glb', output: `wright-1903-engine-${RELEASE}.glb.gz` },
];

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const unpack = (bytes) => (bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes) : bytes);

export async function buildModel(model, web) {
  const sourceFile = path.join(web, model.source);
  const sourceTransfer = fs.readFileSync(sourceFile);
  const sourceDecoded = unpack(sourceTransfer);
  const { glb, gzip, report } = await optimizeModel(new Uint8Array(sourceDecoded));
  fs.writeFileSync(path.join(web, model.output), gzip);
  if (model.fallback) fs.writeFileSync(path.join(web, model.fallback), glb);
  return {
    id: model.id,
    source: { file: model.source, transferBytes: sourceTransfer.length, transferSha256: sha256(sourceTransfer), decodedBytes: sourceDecoded.length, decodedSha256: sha256(sourceDecoded) },
    optimized: {
      file: model.output,
      transferBytes: gzip.length,
      transferSha256: sha256(gzip),
      decodedBytes: glb.length,
      decodedSha256: sha256(glb),
      ...(model.fallback ? { fallbackFile: model.fallback, fallbackBytes: glb.length, fallbackSha256: sha256(glb) } : {}),
      driveId: null,
      ...(model.fallback ? { fallbackDriveId: null } : {}),
    },
    saving: {
      transferPercent: Number(((1 - gzip.length / sourceTransfer.length) * 100).toFixed(1)),
      decodedPercent: Number(((1 - glb.length / sourceDecoded.length) * 100).toFixed(1)),
    },
    changes: {
      triangles: report.triangles,
      trianglesUnchanged: report.trianglesUnchanged,
      sharedDataUnchanged: report.sharingKeptSurfaces,
      accessorsBefore: report.accessorsBeforeSharing,
      accessorsAfter: report.accessorsAfterSharing,
      animationKeysBefore: report.animation?.keysBefore ?? 0,
      animationKeysAfter: report.animation?.keysAfter ?? 0,
    },
    measuredError: {
      modelSizeMetres: report.modelSize,
      positionAbsolute: report.positionErrorAbsolute,
      positionRelativeToModel: report.positionErrorRelativeToModel,
      normalDegrees: report.normalErrorDegrees,
      animationTranslationRelativeToModel: report.animation?.translationRelativeToModel ?? 0,
      animationRotationDegrees: report.animation?.rotationDegrees ?? 0,
    },
    roundTripExact: report.roundTripExact,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const web = flag('--into', 'web');
  const recordFile = flag('--record', `releases/model-optimization-${RELEASE}.json`);
  const only = args.includes('--only') ? args.slice(args.indexOf('--only') + 1).filter((value) => !value.startsWith('--')) : [];
  const previous = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : undefined;
  const models = new Map((previous?.models ?? []).map((entry) => [entry.id, entry]));
  for (const model of MODELS) {
    if (only.length && !only.includes(model.id)) continue;
    console.log(`optimising ${model.id} ...`);
    const entry = await buildModel(model, web);
    // Keep what was recorded about the same file earlier (its Drive id, the render check) when the bytes did not change.
    const earlier = models.get(model.id);
    if (earlier?.optimized.transferSha256 === entry.optimized.transferSha256) {
      entry.optimized.driveId = earlier.optimized.driveId;
      if (earlier.optimized.fallbackDriveId !== undefined) entry.optimized.fallbackDriveId = earlier.optimized.fallbackDriveId;
      if (earlier.renderCheck) entry.renderCheck = earlier.renderCheck;
    }
    models.set(model.id, entry);
    console.log(`  transfer ${(entry.source.transferBytes / 1048576).toFixed(2)} -> ${(entry.optimized.transferBytes / 1048576).toFixed(2)} MB (${entry.saving.transferPercent}%), decoded ${(entry.source.decodedBytes / 1048576).toFixed(2)} -> ${(entry.optimized.decodedBytes / 1048576).toFixed(2)} MB`);
  }
  const record = {
    schema: '4212.model-optimization/v1',
    release: RELEASE,
    description: 'Lossless-looking optimisation of the teaching models (scripts/optimize_model.mjs). The current files are untouched; these are new files that are not yet published or bound. See docs/model-optimization.md.',
    tool: { optimizer: 'scripts/optimize_model.mjs' },
    models: MODELS.map((model) => models.get(model.id)).filter(Boolean),
  };
  fs.mkdirSync(path.dirname(recordFile), { recursive: true });
  fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`record: ${recordFile}`);
}
