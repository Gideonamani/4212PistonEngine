// Apply a reworked lesson to its pack. Usage: node apply_lesson.mjs <pack json> <content module>
// The content module exports LESSON_ID, STEPS ({keep: n, ...patch} reuses existing step n), CHECKS (added after the lesson's kept checks),
// SOURCES (added to the pack registry), and optionally SOURCE_UPDATES, COMPLETION_CRITERIA, DROP_CHECKS (ids to remove) and
// EXPECTED_STEP_COUNT (the lesson's step count before the rework: applying a second time then fails instead of re-indexing the new steps).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { arrayAt, serialize } from './splice.mjs';

const [file, contentPath] = process.argv.slice(2);
const content = await import(pathToFileURL(path.resolve(contentPath)).href);
const { LESSON_ID, STEPS, CHECKS = [], SOURCES = [], SOURCE_UPDATES = {}, COMPLETION_CRITERIA, DROP_CHECKS = [], EXPECTED_STEP_COUNT } = content;
let text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const pack = JSON.parse(text);
const lesson = pack.lessons.find((item) => item.id === LESSON_ID);
if (!lesson) throw new Error(`no lesson ${LESSON_ID}`);
if (EXPECTED_STEP_COUNT !== undefined && lesson.steps.length !== EXPECTED_STEP_COUNT) {
  throw new Error(`${LESSON_ID} has ${lesson.steps.length} steps and the draft expects ${EXPECTED_STEP_COUNT}: has it been applied already? { keep: n } indexes the original steps`);
}

const steps = STEPS.map((step) => {
  if (step.keep === undefined) return step;
  const { keep, ...patch } = step;
  return { ...lesson.steps[keep], ...patch };
});
const keptChecks = pack.checks.filter((check) => check.lessonId === LESSON_ID && !DROP_CHECKS.includes(check.id));
const newChecks = [...keptChecks, ...CHECKS];
const known = new Set(pack.checks.map((check) => check.id));
for (const check of CHECKS) if (known.has(check.id)) throw new Error(`check id exists: ${check.id}`);

const lessonSpan = () => {
  const lessons = arrayAt(text, 'lessons', 2);
  const index = lessons.elements.findIndex((element) => new RegExp(`"id":\\s*"${LESSON_ID}"`).test(element));
  return { index, span: lessons.spans[index] };
};

// 1. completionCriteria, inside the lesson.
if (COMPLETION_CRITERIA) {
  const { span } = lessonSpan();
  const element = text.slice(span[0], span[1]);
  const patched = element.replace(/("completionCriteria":\s*)"(?:[^"\\]|\\.)*"/, (_match, head) => `${head}${JSON.stringify(COMPLETION_CRITERIA)}`);
  if (patched === element) throw new Error('no completionCriteria to replace');
  text = text.slice(0, span[0]) + patched + text.slice(span[1]);
}

// 2. The steps.
{
  const { span } = lessonSpan();
  const stepsArray = arrayAt(text, 'steps', 6, span[0]);
  text = text.slice(0, stepsArray.first) + steps.map((step) => serialize(step, 8, eol)).join(`,${eol}        `) + text.slice(stepsArray.last);
}

// 3. The checks, in place of the lesson's own.
{
  const checks = arrayAt(text, 'checks', 2);
  const rebuilt = [];
  let placed = false;
  for (const element of checks.elements) {
    if (new RegExp(`"lessonId":\\s*"${LESSON_ID}"`).test(element)) {
      if (!placed) { rebuilt.push(...newChecks.map((check) => serialize(check, 4, eol))); placed = true; }
    } else rebuilt.push(element);
  }
  text = text.slice(0, checks.first) + rebuilt.join(`,${eol}    `) + text.slice(checks.last);
}

// 4. The pack's source registry: updated entries in place, new ones added at the end.
{
  const sources = arrayAt(text, 'sources', 2);
  const current = JSON.parse(`[${sources.elements.join(',')}]`).map((source) => (SOURCE_UPDATES[source.id] ? { ...source, ...SOURCE_UPDATES[source.id] } : source));
  const have = new Set(current.map((source) => source.id));
  const merged = [...current, ...SOURCES.filter((source) => !have.has(source.id))];
  text = text.slice(0, sources.first) + merged.map((source) => serialize(source, 4, eol)).join(`,${eol}    `) + text.slice(sources.last);
}

JSON.parse(text);
fs.writeFileSync(file, text);
const after = JSON.parse(text);
const l = after.lessons.find((item) => item.id === LESSON_ID);
console.log(LESSON_ID, 'steps', l.steps.length, 'checks', after.checks.filter((check) => check.lessonId === LESSON_ID).length, 'sources', after.sources.length);
