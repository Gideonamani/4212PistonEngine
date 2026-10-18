import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  BANNED_STUDENT_PATTERNS,
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

test('known catalogue errors are corrected in the engineering cross-check', () => {
  const byId = Object.fromEntries(doc.definitions.map((d) => [d.id, d]));
  const ipcParts = (id) => byId[id].engineering.ipcIo520.map((r) => r.partNumber);
  assert.ok(ipcParts('camshaft').includes('535661'), '535661 is the camshaft');
  assert.ok(ipcParts('crankshaft').includes('631716A2'), 'the crankshaft assembly is 631716A2');
  assert.ok(!ipcParts('crankshaft').includes('535661'), '535661 must not be the crankshaft');
  assert.ok(ipcParts('crankshaft-gear-dowel').includes('536563'), '536563 is the crankshaft-to-gear dowel');
  assert.ok(ipcParts('tach-drive-bevel-gear').includes('535908'), '535908 is the tach drive bevel gear assembly');
  assert.ok(ipcParts('idler-support-gasket').includes('534740'), '534740 is the idler support pin gasket');
  const notInCatalogue = ['535661-CAM', '633403-CAP', '635439-U', '631496-IN', 'RHB32E-S', '636000', '636015'];
  const prior = new Set(doc.definitions.flatMap((d) => d.engineering.priorData.partNumbers.filter((p) => !p.inIo520Catalogue).map((p) => p.partNumber)));
  for (const pn of notInCatalogue) assert.ok(prior.has(pn), `${pn} (from the old register) must be recorded as absent from the IO-520 catalogue`);
  const withPrior = doc.definitions.filter((d) => d.engineering.priorData.partNumbers.length > 0).length;
  assert.ok(withPrior >= 100, `the old register's part numbers should be kept for the cross-check, found them on ${withPrior} definitions`);
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
