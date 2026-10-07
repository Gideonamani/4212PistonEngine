import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// The check on a pull request is several jobs side by side, gathered by the one job branch protection requires ("verify"). Some
// mistakes in that arrangement leave CI green while checking less, or publishing nothing, so they are tests: a viewport project that
// no job runs, a job the gate does not wait for, and a deploy condition that a skipped job upstream would switch off.

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const config = fs.readFileSync('playwright.config.ts', 'utf8');

/** The top-level jobs of the workflow: id -> the text of its block. */
function jobs() {
  const body = workflow.split(/^jobs:\s*$/m)[1];
  assert.ok(body, 'the workflow has a jobs section');
  const found = new Map();
  let id = null;
  for (const line of body.split(/\r?\n/)) {
    const start = line.match(/^ {2}([a-z][a-z0-9_-]*):\s*$/);
    if (start) { id = start[1]; found.set(id, ''); } else if (id) found.set(id, `${found.get(id)}${line}\n`);
  }
  return found;
}

/** The inline list after `key:` in a block, such as `needs: [a, b]` or `project: [a, b]`. */
function list(block, key) {
  const match = block.match(new RegExp(`^\\s*${key}:\\s*\\[([^\\]]*)\\]`, 'm'));
  assert.ok(match, `a "${key}" list was found`);
  return match[1].split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

test('every browser-test project in playwright.config.ts has a job in the e2e matrix, and the matrix names no other', () => {
  const projects = config.split('projects: [')[1].split('webServer')[0];
  const configured = [...projects.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.ok(configured.length > 0, 'the config lists projects');
  assert.deepEqual(list(jobs().get('e2e'), 'project').sort(), configured.sort());
});

test('the verify gate waits for every other job except deploy', () => {
  const all = jobs();
  const waited = list(all.get('verify'), 'needs');
  for (const id of all.keys()) {
    if (id === 'verify' || id === 'deploy') continue;
    assert.ok(waited.includes(id), `verify must need "${id}", or "${id}" could fail without failing the required check`);
  }
});

test('every job has its own time limit', () => {
  for (const [id, block] of jobs()) assert.match(block, /^ {4}timeout-minutes:\s*\d+/m, `${id} has a timeout-minutes`);
});

test('deploy runs on the results it names, not on the default that a skipped job upstream would switch off', () => {
  const deploy = jobs().get('deploy');
  const condition = deploy.match(/^ {4}if:\s*(.+)$/m)?.[1] ?? '';
  assert.match(condition, /always\(\)/, 'a condition without always() skips the deploy whenever any job upstream was skipped');
  assert.match(condition, /needs\.verify\.result == 'success'/);
  assert.match(condition, /needs\.site\.result == 'success'/);
  assert.match(condition, /github\.event_name != 'pull_request'/, 'a pull request must never publish');
  assert.deepEqual(list(deploy, 'needs').sort(), ['site', 'verify']);
});
