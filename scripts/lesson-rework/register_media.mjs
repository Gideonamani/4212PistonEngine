// Registers new lesson pictures. Usage (repo root): node scripts/lesson-rework/register_media.mjs <module>
// The module exports `figures` ({ id: { pdf, page, box, width } }, built from a PDF by scripts/build_lesson_figures.py)
// and `attribution` ({ 'file.webp': { title, creator?, source, license } }, shown on the Credits page).
// Existing entries are left alone; new ones are added as text so the files keep their formatting.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { figures = {}, attribution = {} } = await import(pathToFileURL(path.resolve(process.argv[2])).href);

const sourcesFile = 'web/lesson-media/figure-sources.json';
let text = fs.readFileSync(sourcesFile, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const sources = JSON.parse(text);
const additions = Object.entries(figures).filter(([id]) => !sources[id]);
if (additions.length) {
  const block = additions.map(([id, spec]) => [
    `  "${id}": {`,
    `    "pdf": ${JSON.stringify(spec.pdf)},`,
    `    "page": ${spec.page},`,
    `    "box": [${spec.box.join(', ')}],`,
    `    "width": ${spec.width}`,
    '  }',
  ].join(eol)).join(`,${eol}`);
  const end = text.lastIndexOf('}');
  text = `${text.slice(0, end).replace(/\s*$/, '')},${eol}${block}${eol}}${eol}`;
  JSON.parse(text);
  fs.writeFileSync(sourcesFile, text);
}

const attributionFile = 'web/lesson-media/attribution.json';
const raw = fs.readFileSync(attributionFile, 'utf8');
const current = JSON.parse(raw);
let added = 0;
for (const [file, entry] of Object.entries(attribution)) if (!current[file]) { current[file] = entry; added += 1; }
const crlf = raw.includes('\r\n');
const out = JSON.stringify(current, null, 2) + (raw.endsWith('\n') ? '\n' : '');
fs.writeFileSync(attributionFile, crlf ? out.replace(/\n/g, '\r\n') : out);
console.log('registered', additions.length, 'figure sources and', added, 'credits');
