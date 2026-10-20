import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  BANNED_STUDENT_PATTERNS,
  CATALOGUE_DATA,
  CYLINDER_MODEL_ID,
  LIMITS,
  PART_NUMBER_PATTERNS,
  R10_MODEL_ID,
  ROOT,
  STORE_DIR,
  allStrings,
  instanceDocFor,
  loadStore,
  mapParts,
  modelPartIds,
  outPathFor,
  projectModel,
  projectedModels,
  serialise,
} from './part_store.mjs';

// The part store (knowledge/part-cards/parts/, docs/part-store.md): what the Node side checks is the projection that ships and what must
// never reach the browser. The rules for the store itself (statuses, sources, review gates) are the Python validator's, run by
// scripts/test_knowledge_store.py; this file runs it too when Python is installed.

const loaded = loadStore();
const PRIVATE_ENGINEERING_PATH = path.join(ROOT, 'data/gtsio_part_authoring/private/definitions-engineering.json');
const PART_NUMBER_IN_CODE = /(?<![-\w])\d{5,6}[A-Z]?\d*\b/;
const CLAIM_FIELDS = ['title', 'function', 'madeOf', 'sits', 'lookFor'];
const projections = new Map(projectedModels(loaded).map((doc) => [doc.model, projectModel(loaded, doc.model)]));

test('the store gives the R10 engine and the operating cylinder their own learner files', () => {
  assert.deepEqual([...projections.keys()].sort(), [CYLINDER_MODEL_ID, R10_MODEL_ID].sort());
  assert.equal(modelPartIds(instanceDocFor(loaded, R10_MODEL_ID)).length, 1396);
  assert.equal(modelPartIds(instanceDocFor(loaded, CYLINDER_MODEL_ID)).length, 61);
});

test('every part of every model maps to exactly one definition, and every definition is used by some model', () => {
  const used = new Set();
  for (const doc of loaded.instances) {
    const { rows, unmatched, ambiguous } = mapParts(doc, modelPartIds(doc));
    assert.deepEqual(unmatched, [], `${doc.model}: unmatched parts: ${unmatched.slice(0, 10).join(', ')}`);
    assert.deepEqual(ambiguous, [], `${doc.model}: ambiguous parts: ${JSON.stringify(ambiguous.slice(0, 5))}`);
    for (const hit of Object.values(rows)) used.add(hit.definition);
  }
  for (const d of loaded.definitions) assert.ok(used.has(d.id), `${d.id} is used by no model`);
});

test('no two parts of one model share a label', () => {
  for (const [model, projection] of projections) {
    const seen = new Map();
    for (const [pid, [definitionId, instance]] of Object.entries(projection.parts)) {
      const definition = projection.definitions[definitionId];
      const label = [definition.title.text, definition.context, instance].filter(Boolean).join(' · ');
      assert.ok(!seen.has(label), `${model}: ${pid} and ${seen.get(label)} are both labelled "${label}"`);
      seen.set(label, pid);
    }
  }
});

test('learner text is plain: every claim has a status and evidence, with no placeholders, specifications or catalogue numbers', () => {
  for (const [model, projection] of projections) {
    const claims = [];
    for (const [id, d] of Object.entries(projection.definitions)) for (const field of CLAIM_FIELDS) claims.push([`${id}.${field}`, field, d[field]]);
    for (const [pid, own] of Object.entries(projection.overrides ?? {})) {
      for (const [field, claim] of Object.entries(own)) if (typeof claim === 'object' && field !== 'system') claims.push([`${pid} (own).${field}`, field, claim]);
    }
    for (const [where, field, claim] of claims) {
      assert.ok(claim.text.length > 3, `${model} ${where} is empty`);
      assert.ok(claim.text.split(/\s+/).length <= LIMITS[field], `${model} ${where} is too long: ${claim.text}`);
      assert.ok(claim.status in projection.statuses, `${model} ${where} has no status`);
      assert.ok(claim.status === 'specified' || claim.status === 'derived' ? claim.source : claim.basis, `${model} ${where} has no evidence`);
      for (const re of BANNED_STUDENT_PATTERNS) assert.ok(!re.test(claim.text), `${model} ${where} matches ${re}: ${claim.text}`);
    }
  }
});

test('a learner file carries no engineering block and no part number', () => {
  for (const [model, projection] of projections) {
    const json = JSON.stringify(projection);
    for (const key of ['"engineering"', '"legacyValues"', '"ipcIo520"', '"gtsioManual"', '"gtsioOnlineIpcH1b"', '"priorData"', '"alignment"', '"match"', '"rowText"', '"partNumber"', '"lessonTerms"', '"reviewed_by"']) {
      assert.ok(!json.includes(key), `${model}: the file contains ${key}`);
    }
    assert.ok(!CATALOGUE_DATA.test(JSON.stringify(Object.values(projection.definitions).map(({ catalogue, ...plain }) => plain))), `${model}: a part number or the retired H1B capture reached the file`);
    for (const d of Object.values(projection.definitions)) {
      const { catalogue, ...plain } = d;
      for (const s of allStrings(plain)) for (const re of BANNED_STUDENT_PATTERNS) assert.ok(!re.test(s), `${model}: string matches ${re}: ${s}`);
      if (catalogue) for (const re of PART_NUMBER_PATTERNS) assert.ok(!re.test(catalogue.description), `${model}: catalogue line matches ${re}: ${catalogue.description}`);
    }
  }
});

test('no shipped data or built bundle contains the engineering cross-check', () => {
  const forbidden = ['"ipcIo520"', '"gtsioOnlineIpcH1b"', '"priorData"', '"legacyValues"', 'ipc-catalog'];
  const scan = (dir, exts) => {
    if (!existsSync(dir)) return [];
    const hits = [];
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) hits.push(...scan(full, exts));
      else if (exts.includes(path.extname(name)) && st.size < 20_000_000) {
        const text = readFileSync(full, 'utf8');
        for (const f of forbidden) if (text.includes(f)) hits.push(`${path.relative(ROOT, full)} contains ${f}`);
      }
    }
    return hits;
  };
  assert.deepEqual(scan(path.join(ROOT, 'web'), ['.json']), []);
  assert.deepEqual(scan(path.join(ROOT, 'dist'), ['.json', '.js', '.html']), []);
});

test('each shipped learner file is what the store projects', () => {
  for (const doc of projectedModels(loaded)) {
    const file = outPathFor(doc);
    assert.ok(existsSync(file), `${doc.projection.file} is missing; run: node scripts/build_part_details.mjs`);
    const shipped = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(shipped, JSON.parse(JSON.stringify(projections.get(doc.model))), `${doc.projection.file} is out of date; run: node scripts/build_part_details.mjs`);
  }
});

// The move from data/gtsio520-part-definitions.json into the store (the part-store pilot) changed nothing a learner of the R10 engine reads.
// This pins the content of the file as it was before the move, apart from its schema name; the hash is of the compact JSON of the rest.
// When the R10 text is edited on purpose (a review, a correction), change the hash in the same pull request, so the edit is seen.
const R10_BEFORE_THE_MOVE = '2f5e1e864bb9e91b53c6997e4c89ac5af33583bad7ef032d8bbd75cc0dd2f7ec';
test('the R10 learner file is unchanged by the move into the store (apart from its schema name)', () => {
  const { schema, ...rest } = projections.get(R10_MODEL_ID);
  assert.match(schema, /^gtsio520-r10-parts\/\d+$/);
  const hash = createHash('sha256').update(JSON.stringify(rest)).digest('hex');
  assert.equal(hash, R10_BEFORE_THE_MOVE, 'the R10 text changed; if that was meant, update R10_BEFORE_THE_MOVE with the new hash');
  assert.equal(Object.keys(rest.definitions).length, 188);
  assert.equal(Object.keys(rest.parts).length, 1396);
  assert.equal(rest.overrides, undefined, 'R10 has no wording of its own for any part');
});

test('the cylinder gives its own wording only where the shared line would be wrong for it, and ships only what a learner can read', () => {
  const projection = projections.get(CYLINDER_MODEL_ID);
  assert.equal(Object.keys(projection.parts).length, 61);
  for (const [pid, own] of Object.entries(projection.overrides ?? {})) {
    assert.ok(pid in projection.parts, `${pid} has wording of its own but is not a part of the model`);
    assert.equal(own.review, undefined, 'the parts are drafts like their definitions; an own review state would only differ once one is reviewed');
    for (const [field, claim] of Object.entries(own)) {
      if (typeof claim !== 'object') continue;
      assert.notDeepEqual(claim, projection.definitions[projection.parts[pid][0]][field], `${pid}.${field} repeats its definition`);
    }
  }
  // The R10 model is not the cylinder: no cylinder line may cite it, and the shared line it would replace is not carried as dead data.
  for (const s of allStrings(projection)) assert.ok(!/R10/.test(s), `the cylinder file cites the R10 model: ${s}`);
  // The cylinder's own lines (store rows with `claims`) are what its learner file says.
  const rows = instanceDocFor(loaded, CYLINDER_MODEL_ID).parts.filter((row) => row.claims);
  assert.ok(rows.length >= 10, 'the cylinder gives wording of its own for a number of parts');
  for (const row of rows) {
    for (const [field, claim] of Object.entries(row.claims)) {
      const [definitionId] = projection.parts[row.id];
      const shown = projection.overrides?.[row.id]?.[field] ?? projection.definitions[definitionId][field];
      assert.deepEqual(shown, claim, `${row.id}.${field}: the learner file does not say what the store row says`);
    }
  }
});

test('when every part of a kind has the same wording of its own it becomes the kind\'s line; when they differ each keeps its own', () => {
  const copy = structuredClone(loaded);
  const rows = instanceDocFor(copy, CYLINDER_MODEL_ID).parts;
  const ring2 = rows.find((row) => row.id === 'PistonRing2');
  ring2.claims.madeOf = { ...ring2.claims.madeOf, text: 'a different cast iron' };
  const projection = projectModel(copy, CYLINDER_MODEL_ID);
  assert.equal(projection.overrides.PistonRing1.madeOf.text, 'gray cast iron');
  assert.equal(projection.overrides.PistonRing2.madeOf.text, 'a different cast iron');
  assert.equal(projection.definitions['compression-ring'].madeOf.text, loaded.definitions.find((d) => d.id === 'compression-ring').student.madeOf.text, 'the kind\'s own line is left as the store has it');
  const plain = projections.get(CYLINDER_MODEL_ID);
  assert.equal(plain.overrides, undefined);
  assert.equal(plain.definitions['compression-ring'].madeOf.text, 'gray cast iron');
});

test('catalogue rows and part numbers stay out of Git', (t) => {
  // The committed store and the committed data beside it carry no catalogue rows, old-register values or part numbers.
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== 'private') walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.json')) files.push(path.join(dir, entry.name));
    }
  };
  walk(STORE_DIR);
  walk(path.join(ROOT, 'data/gtsio_part_authoring'));
  files.push(...[...projectedModels(loaded)].map(outPathFor));
  assert.ok(files.length >= 8, 'expected the store files, the snapshots and the shipped files');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const key of ['ipcIo520', 'gtsioOnlineIpcH1b', 'priorData', 'rowText']) assert.ok(!text.includes(key), `${path.relative(ROOT, file)} contains ${key}`);
    assert.ok(!CATALOGUE_DATA.test(text), `${path.relative(ROOT, file)} contains a part number or the retired H1B capture: ${text.match(CATALOGUE_DATA)?.[0]}`);
  }
  // The authoring scripts carry no part numbers either (their catalogue references live with the private rows).
  for (const name of readdirSync(path.join(ROOT, 'scripts/gtsio_part_authoring')).filter((file) => file.endsWith('.py'))) {
    const text = readFileSync(path.join(ROOT, 'scripts/gtsio_part_authoring', name), 'utf8');
    assert.ok(!PART_NUMBER_IN_CODE.test(text), `scripts/gtsio_part_authoring/${name} contains a part number: ${text.match(PART_NUMBER_IN_CODE)?.[0]}`);
  }
  // And Git does not track the rows, wherever they are put.
  const listed = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  if (listed.status !== 0) {
    t.diagnostic('git is not available: the tracked-file check was skipped');
    return;
  }
  const tracked = listed.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  const offenders = tracked.filter((file) => /(^|\/)ipc_rows\.json$/.test(file) || /(^|\/)(ipc_refs|ipc_corrections|prior_contract_parts|definitions-engineering)\.json$/.test(file) || file.includes('gtsio_part_authoring/private/'));
  assert.deepEqual(offenders, [], 'catalogue data must stay in data/gtsio_part_authoring/private (ignored by Git)');
});

test('known catalogue errors are corrected in the private engineering cross-check', (t) => {
  if (!existsSync(PRIVATE_ENGINEERING_PATH)) {
    t.skip('the private catalogue data is not present (data/gtsio_part_authoring/private): catalogue-row checks skipped');
    return;
  }
  const full = JSON.parse(readFileSync(PRIVATE_ENGINEERING_PATH, 'utf8'));
  const byId = Object.fromEntries(full.definitions.map((d) => [d.id, d]));
  const numbers = (id) => byId[id].engineering.ipcIo520.map((row) => row.partNumber).filter(Boolean);
  // The old register gave the camshaft's catalogue number to the crankshaft: the two must have different numbers.
  assert.ok(numbers('camshaft').length > 0 && numbers('crankshaft').length > 0, 'both shafts have catalogue rows');
  assert.ok(!numbers('camshaft').some((pn) => numbers('crankshaft').includes(pn)), 'the camshaft and the crankshaft must not share a catalogue number');
  // The old register's numbers are kept for the cross-check, and the ones the IO-520 catalogue does not list are flagged.
  const withPrior = full.definitions.filter((d) => d.engineering.priorData.partNumbers.length > 0).length;
  assert.ok(withPrior >= 100, `the old register's part numbers should be kept for the cross-check, found them on ${withPrior} definitions`);
  const absent = new Set(full.definitions.flatMap((d) => d.engineering.priorData.partNumbers.filter((p) => !p.inIo520Catalogue).map((p) => p.partNumber)));
  assert.ok(absent.size >= 30, `the old numbers absent from the IO-520 catalogue should be flagged, found ${absent.size}`);
  // The six corrections the instructor was told about are recorded.
  const corrected = full.definitions.filter((d) => d.engineering.note).map((d) => d.id).sort();
  assert.deepEqual(corrected, ['camshaft', 'crankshaft', 'crankshaft-gear-dowel', 'idler-support-gasket', 'starter-needle-bearing', 'tach-drive-bevel-gear']);
  // Every alignment result agrees with what the rows and the manual keys give.
  for (const d of full.definitions) {
    const { result } = d.engineering.alignment;
    if (result === 'mismatch') continue;
    const rows = d.engineering.ipcIo520.length;
    const manual = d.engineering.gtsioManual.length;
    const want = rows && manual ? 'confirmed' : manual ? 'gtsio_only' : rows ? 'io520_only' : 'not_found';
    assert.equal(result, want, `${d.id}: alignment ${result}, but ${rows} catalogue rows and ${manual} manual keys give ${want}`);
  }
});

test('the Python validator accepts the store', (t) => {
  const python = ['python3', 'python'].find((name) => {
    const probe = spawnSync(name, ['--version'], { encoding: 'utf8' });
    return probe.status === 0 && /^Python 3/.test(`${probe.stdout}${probe.stderr}`);
  });
  if (!python) {
    t.skip('Python 3 is not installed');
    return;
  }
  const run = spawnSync(python, ['-m', 'cad_pipeline.intent.part_store'], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});

test('the build script finds its registry entries and the files are up to date', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build_part_details.mjs'), '--check'], { encoding: 'utf8', cwd: ROOT });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(serialise(projections.get(R10_MODEL_ID)).endsWith('\n'), true);
});
