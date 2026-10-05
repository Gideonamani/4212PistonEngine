import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// docs/README.md sorts every document into a guide (kept accurate), a record (dated, left as written) or the index itself. The guides, the
// README and AGENTS.md must not point at files that no longer exist or name things the app has retired. Records are exempt: they say what
// was true on their date.

const index = fs.readFileSync('docs/README.md', 'utf8');
const kinds = new Map([...index.matchAll(/^\|\s*\[([^\]]+\.md)\]\([^)]*\)\s*\|\s*(guide|record|index)\s*\|/gim)].map((match) => [match[1], match[2].toLowerCase()]));

/** Every file in the repository that is tracked by Git or not ignored, as repo-relative paths with forward slashes. */
function repoFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean);
  } catch {
    const found = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.git', 'build', '.local', 'test-results'].includes(entry.name)) continue;
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else found.push(full.split(path.sep).join('/').replace(/^\.\//, ''));
      }
    };
    walk('.');
    return found;
  }
}

const files = repoFiles();
const exact = new Set(files);
const names = new Set(files.map((file) => file.split('/').pop()));

// Files the guides may name although they are not in the repository: outputs a script writes, and the ignored model binaries.
// Native CAD sources (FreeCAD, Blender, STEP) live in Drive, not in Git.
const GENERATED = /^(build|dist|node_modules|\.local|test-results)\/|\.glb(\.gz)?$|\.(FCStd|blend|step)$|^\.\.\//;
const RETIRED = ['ModelViewer', 'MobileFrame', 'VisualIllustration', 'draftStatus', 'Phone Shell', 'learn.html', 'explore.html', 'check.html', 'training.html', 'viewer.js', 'training-modes.mjs', 'model-router.mjs', 'general-lessons.json'];

const guides = [...kinds].filter(([, kind]) => kind === 'guide').map(([name]) => `docs/${name}`).concat(['README.md', 'AGENTS.md']);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text, name) => new RegExp(`(?<![\\w.-])${escapeRegExp(name)}(?![\\w])`).test(text);

function pathsIn(text) {
  const found = new Set();
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const token = match[1].trim().replace(/[.,:;)]+$/, '').replace(/#.*$/, '').replace(/:\d+$/, '');
    if (/[\s*<>{}$|=()]/.test(token) || /^https?:/.test(token) || token.startsWith('-') || /^[\w.-]+@/.test(token)) continue;
    const looksLikePath = /^(src|scripts|web|docs|data|e2e|releases|\.github|\.agents|cad_pipeline|cad-studies)\//.test(token) || /^[\w.-]+\.(tsx?|mjs|cjs|py|json|md|yml|css|html)$/.test(token);
    if (looksLikePath) found.add(token);
  }
  return [...found];
}

test('every document is sorted into guide, record or index in docs/README.md', () => {
  const documents = fs.readdirSync('docs').filter((name) => name.endsWith('.md')).sort();
  assert.deepEqual(documents.filter((name) => !kinds.has(name)), [], 'documents missing from the index table');
  assert.deepEqual([...kinds.keys()].filter((name) => !documents.includes(name)), [], 'index rows for documents that do not exist');
  assert.equal([...kinds.values()].filter((kind) => kind === 'index').length, 1);
  assert.ok(guides.length > 10, 'the guides were found');
});

test('guides name only files that exist', () => {
  const dead = [];
  for (const guide of guides) {
    for (const token of pathsIn(fs.readFileSync(guide, 'utf8'))) {
      if (GENERATED.test(token)) continue;
      const found = token.includes('/') ? exact.has(token) || [...exact].some((file) => file.startsWith(`${token.replace(/\/$/, '')}/`)) : names.has(token);
      if (!found) dead.push(`${guide}: ${token}`);
    }
  }
  assert.deepEqual(dead, []);
});

test('guides link only to documents that exist', () => {
  const dead = [];
  for (const guide of guides) {
    for (const match of fs.readFileSync(guide, 'utf8').matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)(?:#[^)]*)?\)/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(guide), match[1]));
      if (!exact.has(target) && !files.some((file) => file.startsWith(`${target}/`))) dead.push(`${guide}: ${match[1]}`);
    }
  }
  assert.deepEqual(dead, []);
});

test('guides do not name things the app has retired', () => {
  const stale = [];
  for (const guide of guides) {
    const text = fs.readFileSync(guide, 'utf8');
    // A whole word only: "useModelViewer" is current, "ModelViewer" and "check.html" are not (nor "valve-transform-check.html").
    for (const name of RETIRED) if (mentions(text, name)) stale.push(`${guide}: ${name}`);
  }
  assert.deepEqual(stale, []);
});

test('the check finds what it is meant to find', () => {
  assert.deepEqual(pathsIn('see `src/App.tsx`, `scripts/nothing-here.mjs` and `LearnView.tsx` but not `a b.ts` or `https://x.y/z.json`'), ['src/App.tsx', 'scripts/nothing-here.mjs', 'LearnView.tsx']);
  assert.ok(exact.has('src/App.tsx') && !exact.has('scripts/nothing-here.mjs'));
  assert.ok(names.has('LearnView.tsx') && !names.has('ModelViewer.tsx'));
  assert.ok(mentions('the ModelViewer component', 'ModelViewer') && mentions('open check.html', 'check.html'));
  assert.ok(!mentions('the useModelViewer hook', 'ModelViewer') && !mentions('valve-transform-check.html', 'check.html') && !mentions('the checkXhtml', 'check.html'));
});
