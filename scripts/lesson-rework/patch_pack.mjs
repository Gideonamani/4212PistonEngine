// Small text edits to an already-applied lesson in a hand-formatted pack, leaving every other byte alone.
// Usage: node scripts/lesson-rework/patch_pack.mjs <pack json> <patch module>
// The patch module exports default (api) => { ... } and may call api.step(lessonId, index, fn), api.check(id, fn), api.insertStep(lessonId, afterIndex, obj), api.lessonModels(lessonId, ids), api.addCheck(obj, afterId), api.addSource(obj), api.source(id, fn).
// Each fn receives a deep copy and returns the replacement object.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { arrayAt, serialize } from './splice.mjs';

const [file, patchPath] = process.argv.slice(2);
let text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const clone = (value) => JSON.parse(JSON.stringify(value));
const pack = () => JSON.parse(text);

const lessonSpan = (lessonId) => {
  const lessons = arrayAt(text, 'lessons', 2);
  const index = lessons.elements.findIndex((element) => new RegExp(`"id":\\s*"${lessonId}"`).test(element));
  if (index < 0) throw new Error(`no lesson ${lessonId}`);
  return lessons.spans[index];
};

const api = {
  step(lessonId, index, fn) {
    const span = lessonSpan(lessonId);
    const steps = arrayAt(text, 'steps', 6, span[0]);
    const [start, end] = steps.spans[index];
    const next = fn(clone(JSON.parse(steps.elements[index])));
    text = text.slice(0, start) + serialize(next, 8, eol) + text.slice(end);
  },
  check(id, fn) {
    const checks = arrayAt(text, 'checks', 2);
    const index = checks.elements.findIndex((element) => new RegExp(`"id":\\s*"${id}"`).test(element));
    if (index < 0) throw new Error(`no check ${id}`);
    const [start, end] = checks.spans[index];
    text = text.slice(0, start) + serialize(fn(clone(JSON.parse(checks.elements[index]))), 4, eol) + text.slice(end);
  },
  source(id, fn) {
    const sources = arrayAt(text, 'sources', 2);
    const index = sources.elements.findIndex((element) => new RegExp(`"id":\\s*"${id}"`).test(element));
    if (index < 0) throw new Error(`no source ${id}`);
    const [start, end] = sources.spans[index];
    text = text.slice(0, start) + serialize(fn(clone(JSON.parse(sources.elements[index]))), 4, eol) + text.slice(end);
  },
  addSource(source) {
    const sources = arrayAt(text, 'sources', 2);
    if (sources.elements.some((element) => JSON.parse(element).id === source.id)) return;
    text = text.slice(0, sources.last) + `,${eol}    ${serialize(source, 4, eol)}` + text.slice(sources.last);
  },
  // Inserts a step after step `afterIndex` (0-based) of a lesson, so a lesson can grow without rewriting its other steps.
  insertStep(lessonId, afterIndex, step) {
    const span = lessonSpan(lessonId);
    const steps = arrayAt(text, 'steps', 6, span[0]);
    const end = steps.spans[afterIndex][1];
    text = text.slice(0, end) + `,${eol}        ${serialize(step, 8, eol)}` + text.slice(end);
  },
  // Replaces a lesson's `models` list, the one line it sits on at the lesson's own level.
  lessonModels(lessonId, models) {
    const span = lessonSpan(lessonId);
    const lesson = text.slice(span[0], span[1]);
    const match = /^ {6}"models": \[[^\]\n]*\]/m.exec(lesson);
    if (!match) throw new Error(`${lessonId}: no one-line models list`);
    const at = span[0] + match.index;
    text = text.slice(0, at) + `      "models": ${JSON.stringify(models).replace(/,/g, ', ')}` + text.slice(at + match[0].length);
  },
  // Inserts a check after the check `afterId` (so a lesson's checks stay together); a check whose id is already there is left alone.
  addCheck(check, afterId) {
    const checks = arrayAt(text, 'checks', 2);
    if (checks.elements.some((element) => JSON.parse(element).id === check.id)) return;
    const index = checks.elements.findIndex((element) => JSON.parse(element).id === afterId);
    if (index < 0) throw new Error(`no check ${afterId}`);
    const end = checks.spans[index][1];
    text = text.slice(0, end) + `,${eol}    ${serialize(check, 4, eol)}` + text.slice(end);
  },
  pack,
};

const patch = (await import(pathToFileURL(path.resolve(patchPath)).href)).default;
await patch(api);
JSON.parse(text);
fs.writeFileSync(file, text);
console.log('patched', file);
