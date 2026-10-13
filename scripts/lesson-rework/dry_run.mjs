// Try a reworked lesson on a COPY of its pack and check it against the rules in scripts/test_syllabus_lessons.mjs, so web/ is not touched.
// Usage (repo root): node scripts/lesson-rework/dry_run.mjs web/fundamentals-lessons.json scripts/lesson-rework/lesson4-content.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateLessonPack } from '../../web/schema/content-schema.mjs';

const [pack, content] = process.argv.slice(2);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dryrun-'));
const copy = path.join(dir, path.basename(pack));
fs.copyFileSync(pack, copy);
console.log(execFileSync('node', [path.join(import.meta.dirname, 'apply_lesson.mjs'), copy, content], { encoding: 'utf8' }).trim());
const { LESSON_ID } = await import(pathToFileURL(path.resolve(content)).href);
const parsed = JSON.parse(fs.readFileSync(copy, 'utf8'));
const problems = validateLessonPack(parsed);
const lesson = parsed.lessons.find((item) => item.id === LESSON_ID);
const words = (text) => text.trim().split(/\s+/).length;
const refs = new Set(parsed.sources.map((source) => source.id));
for (const step of lesson.steps) {
  if (step.title.length > 40) problems.push(`title too long: ${step.title}`);
  if (words(step.prompt) > 150) problems.push(`${step.title}: ${words(step.prompt)} words`);
  if (!step.note || !step.sourceRefs?.length || !step.mediaPlan?.rationale) problems.push(`${step.title}: note, sourceRefs or mediaPlan missing`);
  for (const ref of step.sourceRefs || []) if (!refs.has(ref)) problems.push(`${step.title}: unknown source ${ref}`);
}
const checks = parsed.checks.filter((check) => check.lessonId === LESSON_ID);
if (checks.length < 8) problems.push(`only ${checks.length} checks`);
if (new Set(checks.map((check) => check.type)).size < 3) problems.push('fewer than three check types');
for (const check of checks) {
  if (!check.rationale) problems.push(`${check.id}: no rationale`);
  if (!check.hint) problems.push(`${check.id}: no hint`);
}
console.log('steps', lesson.steps.map((step) => `${step.title} (${words(step.prompt)}w)`).join(' | '));
console.log('checks', checks.length, [...new Set(checks.map((check) => check.type))].join(','));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'dry run clean');
fs.rmSync(dir, { recursive: true, force: true });
