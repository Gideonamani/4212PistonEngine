// Builds the optimised GTSIO-520-H R10 study file and writes its record.
//
//   node scripts/build_gtsio_r10_optimized.mjs [--into web] [--record releases/model-optimization-gtsio520-r10.json]
//
// Reads web/gtsio520-r10-static.glb.gz, runs scripts/optimize_model.mjs with a 20-bit position mantissa and writes
// web/gtsio520-r10-static-opt1.glb.gz beside it (the current release is never replaced). The record has the same shape as
// releases/model-optimization-opt1.json. Run `node scripts/compare_model_renders.mjs ... --record` afterwards for the render check and parse time.
//
// Why 20 bits and not the optimiser's default 16: the exact-intersection audit (scripts/audit_assembly_interference.py) needs closed solids.
// Measured on this file with the audit's reader, 16 bits (3.8 micrometres) left CrankcaseLeft, CrankcaseRight and GovernorDrivenShaftGear
// unable to be intersected, 18 bits (0.95 micrometres) left both crankcase halves, and 20 bits (0.24 micrometres) left none; the original
// file has none. 20 bits costs about 1.7 MB of transfer over 16 bits.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildModel } from './build_optimized_models.mjs';

export const R10_MODEL = { id: 'gtsio520-h-r10-mechanism-study', source: 'gtsio520-r10-static.glb.gz', output: 'gtsio520-r10-static-opt1.glb.gz' };
export const R10_OPTIONS = Object.freeze({ positionMantissaBits: 20 });
export const R10_RECORD = 'releases/model-optimization-gtsio520-r10.json';
/** The phone budget: at most about the biggest model already shipped (decision D3, 18 October 2026). */
export const BUDGET_TRANSFER_BYTES = 16_000_000;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const web = flag('--into', 'web');
  const recordFile = flag('--record', R10_RECORD);
  const entry = await buildModel(R10_MODEL, web, R10_OPTIONS);
  entry.settings = { ...R10_OPTIONS, normalBits: 12, note: 'Position mantissa raised from the default 16 bits to 20 so every part stays a closed solid for the exact-intersection audit.' };
  entry.renderCheckNote = 'R10 has no baked animation and no morph targets, so the 12 pictures are 3 distinct rest views (iso, front, top) drawn four times; the viewer\'s computed cycle and explosion poses were not rendered. Their geometry comes from the same vertex data, and the exact-intersection audit of the same poses found the same 159 overlapping pairs before and after optimising.';
  const previous = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')).models?.[0] : undefined;
  if (previous?.optimized.transferSha256 === entry.optimized.transferSha256) {
    entry.optimized.driveId = previous.optimized.driveId;
    if (previous.renderCheck) entry.renderCheck = previous.renderCheck;
    if (previous.parseTime) entry.parseTime = previous.parseTime;
  }
  const record = {
    schema: '4212.model-optimization/v1',
    release: 'opt1',
    description: 'Optimisation of the GTSIO-520-H R10 study file (scripts/optimize_model.mjs, 20-bit positions). The current file is untouched; this is a new file that is not published until it is on Drive. See docs/model-optimization.md.',
    tool: { optimizer: 'scripts/optimize_model.mjs', builder: 'scripts/build_gtsio_r10_optimized.mjs' },
    budget: { transferBytes: BUDGET_TRANSFER_BYTES, note: 'about 16 MB gzip, decision D3' },
    models: [entry],
  };
  fs.mkdirSync(path.dirname(recordFile), { recursive: true });
  fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${entry.id}: transfer ${(entry.source.transferBytes / 1e6).toFixed(2)} -> ${(entry.optimized.transferBytes / 1e6).toFixed(2)} MB, decoded ${(entry.source.decodedBytes / 1e6).toFixed(2)} -> ${(entry.optimized.decodedBytes / 1e6).toFixed(2)} MB`);
  console.log(`sha256 (transfer) ${entry.optimized.transferSha256}\nsha256 (decoded)  ${entry.optimized.decodedSha256}\nrecord: ${recordFile}`);
}
