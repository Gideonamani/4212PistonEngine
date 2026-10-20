// Build each model's learner-only part file (web/<model>-parts.json) from the part store (knowledge/part-cards/parts/),
// and keep the model registry's cache-busting token for it in step.
//
//   node scripts/build_part_details.mjs           write every model's file and the registry tokens
//   node scripts/build_part_details.mjs --check   fail if any of them is out of date
//
// A model gets a file when its instance file has a `projection` block. Nothing here edits a model contract.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, loadStore, outPathFor, projectModel, projectedModels, serialise } from './part_store.mjs';

const REGISTRY_PATH = path.join(ROOT, 'src/data/models.json');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const check = process.argv.includes('--check');
const loaded = loadStore();
let registry = readFileSync(REGISTRY_PATH, 'utf8');
const original = registry;
let failed = false;

for (const doc of projectedModels(loaded)) {
  const text = serialise(projectModel(loaded, doc.model));
  const token = createHash('sha256').update(text).digest('hex').slice(0, 12);
  const pattern = new RegExp(`("partDetailsUrl":\\s*"${escapeRegExp(doc.projection.registryUrl)}\\?v=)[0-9a-f]{12}(")`);
  if (!pattern.test(registry)) {
    console.error(`src/data/models.json has no "partDetailsUrl" for ${doc.projection.registryUrl} (model ${doc.model})`);
    process.exit(1);
  }
  registry = registry.replace(pattern, `$1${token}$2`);
  const out = outPathFor(doc);
  const label = path.relative(ROOT, out).split(path.sep).join('/');
  if (check) {
    // A Windows checkout may hold the file with CRLF line endings; the content is what matters.
    const current = existsSync(out) ? readFileSync(out, 'utf8').replaceAll('\r\n', '\n') : null;
    if (current !== text) {
      console.error(`${label} is out of date; run: node scripts/build_part_details.mjs`);
      failed = true;
    } else {
      console.log(`${label} is up to date (registry token ?v=${token})`);
    }
  } else {
    writeFileSync(out, text);
    console.log(`wrote ${label} (${Math.round(text.length / 1024)} KB), registry token ?v=${token}`);
  }
}

if (check) {
  if (registry !== original) {
    console.error('src/data/models.json points at an old parts file token; run: node scripts/build_part_details.mjs');
    failed = true;
  }
  process.exit(failed ? 1 : 0);
}
if (registry !== original) writeFileSync(REGISTRY_PATH, registry);
