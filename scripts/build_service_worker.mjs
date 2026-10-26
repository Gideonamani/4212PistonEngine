// Writes dist/sw.js for the site just built (issue #77): scripts/offline/service-worker.js with the build's VERSION and file lists.
// Runs after vite build and prune_deployed_models.mjs (see package.json), so it lists exactly what is deployed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cacheVersion, precachePlan } from './offline/precache-plan.mjs';

const root = process.argv[2] ?? 'dist';
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [path.relative(root, full).split(path.sep).join('/')];
});

const files = walk(root);
const { core, media } = precachePlan(files);
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 16);
const version = cacheVersion([...core, ...media].map((file) => [file, digest(file)]));
const size = (list) => list.reduce((sum, file) => sum + fs.statSync(path.join(root, file)).size, 0);
const template = fs.readFileSync(new URL('./offline/service-worker.js', import.meta.url), 'utf8');
const header = `const VERSION = ${JSON.stringify(version)};\nconst CORE = ${JSON.stringify(core)};\nconst MEDIA = ${JSON.stringify(media)};\n`;
fs.writeFileSync(path.join(root, 'sw.js'), header + template.replace('/* global VERSION, CORE, MEDIA */\n', ''));
console.log(`sw.js: version ${version}, ${core.length} files saved at install (${(size(core) / 1048576).toFixed(1)} MB), ${media.length} on demand (${(size(media) / 1048576).toFixed(1)} MB)`);
