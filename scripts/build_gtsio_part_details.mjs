// Build web/gtsio520-r10-parts.json (the learner-only view) from data/gtsio520-part-definitions.json,
// and keep the model registry's cache-busting token for it in step.
//
//   node scripts/build_gtsio_part_details.mjs           write both
//   node scripts/build_gtsio_part_details.mjs --check   fail if either is out of date
//
// Paths are relative to the repository; nothing here edits the shipped model contract.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARTS_OUT_PATH,
  loadContractPartIds,
  loadDefinitions,
  serialise,
  studentProjection,
  validateDefinitions,
} from './gtsio_part_details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = path.join(ROOT, 'src/data/models.json');
const URL_PATTERN = /("partDetailsUrl":\s*"\.\/gtsio520-r10-parts\.json\?v=)[0-9a-f]{12}(")/;

const check = process.argv.includes('--check');
const doc = loadDefinitions();
const errors = validateDefinitions(doc);
if (errors.length) {
  console.error(`${errors.length} problem(s) in data/gtsio520-part-definitions.json:`);
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
  process.exit(1);
}

const text = serialise(studentProjection(doc, loadContractPartIds()));
const token = createHash('sha256').update(text).digest('hex').slice(0, 12);
const registry = readFileSync(REGISTRY_PATH, 'utf8');
if (!URL_PATTERN.test(registry)) {
  console.error('src/data/models.json has no "partDetailsUrl" for ./gtsio520-r10-parts.json');
  process.exit(1);
}
const updatedRegistry = registry.replace(URL_PATTERN, `$1${token}$2`);

if (check) {
  // A Windows checkout may hold the file with CRLF line endings; the content is what matters.
  const current = existsSync(PARTS_OUT_PATH) ? readFileSync(PARTS_OUT_PATH, 'utf8').replaceAll('\r\n', '\n') : null;
  if (current !== text) {
    console.error('web/gtsio520-r10-parts.json is out of date; run: node scripts/build_gtsio_part_details.mjs');
    process.exit(1);
  }
  if (updatedRegistry !== registry) {
    console.error(`src/data/models.json points at an old parts file token; run: node scripts/build_gtsio_part_details.mjs (expected ?v=${token})`);
    process.exit(1);
  }
  console.log(`web/gtsio520-r10-parts.json and its registry token (${token}) are up to date`);
} else {
  writeFileSync(PARTS_OUT_PATH, text);
  if (updatedRegistry !== registry) writeFileSync(REGISTRY_PATH, updatedRegistry);
  console.log(`wrote web/gtsio520-r10-parts.json (${Math.round(text.length / 1024)} KB), registry token ?v=${token}`);
}
