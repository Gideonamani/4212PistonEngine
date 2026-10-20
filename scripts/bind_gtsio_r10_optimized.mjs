// Binds the optimised GTSIO-520-H R10 file (releases/model-optimization-gtsio520-r10.json) into the contract, the model registry and the Drive manifest.
//
//   node scripts/bind_gtsio_r10_optimized.mjs [--drive-id <Drive file id>]
//
// Changes only the lines that depend on the asset: web/gtsio520-r10-contract.json (asset_file, asset_sha256, bytes, gzip_bytes), the R10 entry of
// src/data/models.json (localUrl, transferBytes, decodedBytes, driveId, and the ?v= token on contractUrl), docs/drive-asset-manifest.json (the
// R10 web asset; the file it replaces moves to previous_web_releases so the working release stays on record for rollback) and the Drive id in
// releases/model-optimization-gtsio520-r10.json. Line endings are kept.
// Without --drive-id the id is a visible placeholder that no Drive file has: the asset download fails in CI, so the pull request cannot merge before
// the file is uploaded and the real id is bound. Run again with the id once the file is on Drive with link sharing, then check the anonymous download
// (python scripts/fetch_drive_assets.py --verify-remote). Safe to run repeatedly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLACEHOLDER_DRIVE_ID = 'PENDING_DRIVE_UPLOAD_gtsio520_r10_opt1';
const R10_ID = 'gtsio520-h-r10-mechanism-study';

const args = process.argv.slice(2);
const driveId = args.includes('--drive-id') ? args[args.indexOf('--drive-id') + 1] : undefined;
if (driveId !== undefined && !/^[-\w]{20,}$/.test(driveId)) throw new Error(`"${driveId}" is not a Drive file id`);

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(root, file), text);
/** Replace exactly one match of `pattern` (a RegExp with one capture group around the old value). */
function replaceOne(text, pattern, value, what) {
  const matches = text.match(new RegExp(pattern.source, `${pattern.flags}g`)) ?? [];
  if (matches.length !== 1) throw new Error(`${what}: expected one match, found ${matches.length}`);
  return text.replace(pattern, (whole, old) => whole.replace(old, value));
}

const record = JSON.parse(read('releases/model-optimization-gtsio520-r10.json')).models[0];
const optimized = record.optimized;

// 1. The contract: the four asset fields at the top level (two-space indent).
let contract = read('web/gtsio520-r10-contract.json');
const stem = optimized.file.replace(/\.glb\.gz$/, '');
contract = replaceOne(contract, /^  "asset_file": "([^"]*)"/m, `${stem}.glb`, 'contract asset_file');
contract = replaceOne(contract, /^  "asset_sha256": "([0-9a-f]{64})"/m, optimized.decodedSha256, 'contract asset_sha256');
contract = replaceOne(contract, /^  "bytes": (\d+)/m, String(optimized.decodedBytes), 'contract bytes');
contract = replaceOne(contract, /^  "gzip_bytes": (\d+)/m, String(optimized.transferBytes), 'contract gzip_bytes');
write('web/gtsio520-r10-contract.json', contract);

// 2. The registry entry, between its id and its lessonControls line.
let registry = read('src/data/models.json');
const start = registry.indexOf(`"id": "${R10_ID}"`);
const end = registry.indexOf('"lessonControls"', start);
if (start < 0 || end < 0) throw new Error('R10 entry not found in src/data/models.json');
let block = registry.slice(start, end);
const currentId = /"driveId": "([^"]*)"/.exec(block)?.[1];
block = replaceOne(block, /"localUrl": "([^"]*)"/, `./${optimized.file}`, 'registry localUrl');
block = replaceOne(block, /"transferBytes": (\d+)/, String(optimized.transferBytes), 'registry transferBytes');
block = replaceOne(block, /"decodedBytes": (\d+)/, String(optimized.decodedBytes), 'registry decodedBytes');
const nextId = driveId ?? (currentId && currentId !== '1F8B93sONX8mT93GSxRWaRmRuDk0DJCIW' ? currentId : PLACEHOLDER_DRIVE_ID);
block = replaceOne(block, /"driveId": "([^"]*)"/, nextId, 'registry driveId');
block = replaceOne(block, /"contractUrl": "\.\/gtsio520-r10-contract\.json\?v=([0-9a-f]{12})"/, optimized.decodedSha256.slice(0, 12), 'registry contractUrl token');
write('src/data/models.json', registry.slice(0, start) + block + registry.slice(end));

// 3. The manifest: the new R10 asset replaces the old entry, which is kept under previous_web_releases.
let manifestText = read('docs/drive-asset-manifest.json');
const eol = manifestText.includes('\r\n') ? '\r\n' : '\n';
const manifest = JSON.parse(manifestText);
const index = manifest.web_assets.findIndex((asset) => asset.path === 'web/gtsio520-r10-static.glb.gz' || asset.path === `web/${optimized.file}`);
if (index < 0) throw new Error('R10 web asset not found in the manifest');
const old = manifest.web_assets[index];
if (old.path !== `web/${optimized.file}`) {
  const retained = { ...old, retained_reason: 'Previous GTSIO-520-H R10 draft release (unoptimised, 25.3 MB transfer), retained so the optimised file can be rolled back.' };
  if (!manifest.previous_web_releases.some((entry) => entry.drive_id === old.drive_id)) manifest.previous_web_releases.push(retained);
} else if (old.drive_id !== nextId && old.sha256 !== optimized.transferSha256 && !manifest.previous_web_releases.some((entry) => entry.drive_id === old.drive_id)) {
  // A rebuilt release under the same file name (the piston skirt relief, 20 October 2026): the file it replaces stays on Drive and on record for rollback.
  manifest.previous_web_releases.push({ ...old, retained_reason: 'Previous GTSIO-520-H R10 optimised release (before the piston skirt relief of 20 October 2026), retained so the relief release can be rolled back.' });
}
manifest.web_assets[index] = { path: `web/${optimized.file}`, drive_id: nextId, bytes: optimized.transferBytes, sha256: optimized.transferSha256 };
write('docs/drive-asset-manifest.json', JSON.stringify(manifest, null, 2).replace(/\n/g, eol) + (manifestText.endsWith('\n') ? eol : ''));

// 4. The optimisation record names the Drive file the registry uses (null while the id is only the placeholder).
const recordFile = 'releases/model-optimization-gtsio520-r10.json';
const recordDocument = JSON.parse(read(recordFile));
recordDocument.models[0].optimized.driveId = nextId === PLACEHOLDER_DRIVE_ID ? null : nextId;
write(recordFile, `${JSON.stringify(recordDocument, null, 2)}\n`);

console.log(`bound ${optimized.file}: transfer ${optimized.transferBytes} bytes, sha256 ${optimized.transferSha256}`);
console.log(`decoded ${optimized.decodedBytes} bytes, sha256 ${optimized.decodedSha256}`);
console.log(nextId === PLACEHOLDER_DRIVE_ID ? `Drive id: placeholder ${nextId} (upload the file, then rerun with --drive-id)` : `Drive id: ${nextId}`);
