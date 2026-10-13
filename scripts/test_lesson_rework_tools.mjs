import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

// The lesson-rework tools (scripts/lesson-rework) change hand-formatted lesson packs as text. These tests run them on a COPY of a real pack:
// the apply tool only touches the lesson it is told to, and a draft that says how many steps the lesson had refuses to be applied twice.

const TOOLS = path.resolve('scripts/lesson-rework');
const manifest = JSON.parse(readFileSync('web/lessons-manifest.json', 'utf8'));
const packPath = `web/${manifest.packs[0].replace(/^\.\//, '')}`;
const original = JSON.parse(readFileSync(packPath, 'utf8'));
const target = original.lessons[0];
const run = (script, ...args) => execFileSync('node', [path.join(TOOLS, script), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('apply_lesson changes only the lesson it names, and refuses to apply the same draft twice', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'rework-test-'));
  try {
    const copy = path.join(dir, 'pack.json');
    const draft = path.join(dir, 'draft.mjs');
    copyFileSync(packPath, copy);
    writeFileSync(draft, `export const LESSON_ID = ${JSON.stringify(target.id)};\nexport const EXPECTED_STEP_COUNT = ${target.steps.length};\nexport const STEPS = [{ keep: 0 }];\n`);

    run('apply_lesson.mjs', copy, draft);
    const after = JSON.parse(readFileSync(copy, 'utf8'));
    assert.equal(after.lessons[0].steps.length, 1, 'the lesson was cut down to the one kept step');
    assert.deepEqual(after.lessons[0].steps[0], target.steps[0], 'the kept step is unchanged');
    assert.deepEqual(after.lessons.slice(1), original.lessons.slice(1), 'every other lesson is unchanged');
    assert.deepEqual(after.checks, original.checks, 'the checks are unchanged');

    assert.throws(() => run('apply_lesson.mjs', copy, draft), /has been applied already|expects/, 'a second application fails');
    assert.equal(JSON.stringify(JSON.parse(readFileSync(copy, 'utf8'))), JSON.stringify(after), 'the failed second application changed nothing');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('show prints a lesson with its steps and notes', () => {
  const output = run('show.mjs', packPath, target.id, '--notes');
  assert.ok(output.startsWith(`# ${target.title}`));
  assert.ok(output.includes(`[0] (${target.steps[0].type}) ${target.steps[0].title}`));
  assert.ok(output.includes('NOTE:'));
});
