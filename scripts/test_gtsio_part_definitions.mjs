import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  BANNED_STUDENT_PATTERNS,
  CATALOGUE_DATA,
  DEFINITIONS_PATH,
  LIMITS,
  PART_NUMBER_PATTERNS,
  PARTS_OUT_PATH,
  allStrings,
  loadContractPartIds,
  loadDefinitions,
  mapParts,
  studentProjection,
  validateDefinitions,
} from './gtsio_part_details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The full engineering block (with the IO-520 catalogue rows) is written next to the rows, outside Git, when those are present.
const PRIVATE_ENGINEERING_PATH = path.join(ROOT, 'data/gtsio_part_authoring/private/definitions-engineering.json');
const PART_NUMBER_IN_CODE = /(?<![-\w])\d{5,6}[A-Z]?\d*\b/;
const doc = loadDefinitions();
const partIds = loadContractPartIds();

test('the definitions file meets every text and source rule', () => {
  const errors = validateDefinitions(doc);
  assert.deepEqual(errors, [], `${errors.length} problem(s):\n${errors.slice(0, 25).join('\n')}`);
});

test('every R10 part maps to exactly one definition', () => {
  const { unmatched, ambiguous } = mapParts(doc, partIds);
  assert.deepEqual(unmatched, [], `unmatched parts: ${unmatched.slice(0, 10).join(', ')}`);
  assert.deepEqual(ambiguous, [], `ambiguous parts: ${JSON.stringify(ambiguous.slice(0, 5))}`);
});

test('every definition covers at least one part, and part counts add up', () => {
  const { map } = mapParts(doc, partIds);
  const counts = new Map();
  for (const def of Object.values(map)) counts.set(def, (counts.get(def) ?? 0) + 1);
  for (const d of doc.definitions) {
    assert.ok(counts.has(d.id), `${d.id} matches no part of the R10 model`);
    assert.equal(counts.get(d.id), d.partCount, `${d.id}: partCount ${d.partCount} but ${counts.get(d.id)} parts match`);
  }
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), partIds.length);
});

test('no two parts of one kind share the same instance label', () => {
  const proj = studentProjection(doc, partIds);
  const seen = new Map();
  for (const [pid, [defId, instance]] of Object.entries(proj.parts)) {
    const key = `${defId}|${instance}`;
    assert.ok(!seen.has(key), `${pid} and ${seen.get(key)} are both "${defId}" with label "${instance}"`);
    seen.set(key, pid);
  }
});

test('student text is plain: no placeholders, no specifications, no catalogue numbers', () => {
  const proj = studentProjection(doc, partIds);
  for (const [id, d] of Object.entries(proj.definitions)) {
    for (const [field, claim] of [['title', d.title], ['function', d.function], ['madeOf', d.madeOf], ['sits', d.sits], ['lookFor', d.lookFor]]) {
      assert.ok(claim.text.length > 3, `${id}.${field} is empty`);
      assert.ok(claim.text.split(/\s+/).length <= LIMITS[field], `${id}.${field} is too long: ${claim.text}`);
      for (const re of BANNED_STUDENT_PATTERNS) assert.ok(!re.test(claim.text), `${id}.${field} matches ${re}: ${claim.text}`);
    }
  }
});

test('the learner projection carries no engineering block and no part number', () => {
  const proj = studentProjection(doc, partIds);
  const json = JSON.stringify(proj);
  for (const key of ['"engineering"', '"ipcIo520"', '"gtsioManual"', '"gtsioOnlineIpcH1b"', '"priorData"', '"alignment"', '"match"', '"rowText"', '"partNumber"']) {
    assert.ok(!json.includes(key), `projection contains ${key}`);
  }
  for (const d of Object.values(proj.definitions)) {
    const { catalogue, ...plain } = d;
    for (const s of allStrings(plain)) {
      for (const re of BANNED_STUDENT_PATTERNS) assert.ok(!re.test(s), `projection string matches ${re}: ${s}`);
    }
    if (catalogue) {
      for (const re of PART_NUMBER_PATTERNS) assert.ok(!re.test(catalogue.description), `catalogue line matches ${re}: ${catalogue.description}`);
    }
  }
});

test('no shipped data or built bundle contains the engineering cross-check', () => {
  const forbidden = ['"ipcIo520"', '"gtsioOnlineIpcH1b"', '"priorData"', 'ipc-catalog'];
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

test('the shipped learner file, when present, matches the definitions', () => {
  if (!existsSync(PARTS_OUT_PATH)) return;
  const shipped = JSON.parse(readFileSync(PARTS_OUT_PATH, 'utf8'));
  assert.deepEqual(shipped, JSON.parse(JSON.stringify(studentProjection(doc, partIds))), 'run: node scripts/build_gtsio_part_details.mjs');
});

test('catalogue rows and part numbers stay out of Git', (t) => {
  // The committed definitions and the committed data beside them carry no catalogue rows, old-register values or part numbers.
  const committedData = [
    DEFINITIONS_PATH,
    PARTS_OUT_PATH,
    ...readdirSync(path.join(ROOT, 'data/gtsio_part_authoring'), { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(ROOT, 'data/gtsio_part_authoring', entry.name)),
  ];
  for (const file of committedData) {
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

test('the definitions file is exactly what the authoring scripts produce', (t) => {
  const script = path.join(ROOT, 'scripts/gtsio_part_authoring/assemble.py');
  const python = ['python3', 'python'].find((name) => {
    const probe = spawnSync(name, ['--version'], { encoding: 'utf8' });
    return probe.status === 0 && /^Python 3/.test(`${probe.stdout}${probe.stderr}`);
  });
  if (!python) {
    t.skip('Python 3 is not installed');
    return;
  }
  const run = spawnSync(python, [script, '--check'], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});
