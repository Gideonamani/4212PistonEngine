import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { validateLessonPack } from '../web/schema/content-schema.mjs';

// The lessons written for the second half of the syllabus (lessons 8 to 18), and every lesson since reworked against the instructor's
// outcomes (docs/lesson-objectives.md), keep one discipline, checked here so a new lesson cannot skip it: every step says where its claim comes from, every lesson has a card picture and a pack banner, steps stay short, and the
// checks use more than one kind of question and explain themselves. They stay unreviewed until the instructor says otherwise.

const SYLLABUS_PACKS = ['valve-train-and-power', 'breathing-and-performance', 'requirements-and-malfunctions', 'maintenance-lsa-practicals'];
// Lessons 1 to 7 are being reworked one at a time (docs/lesson-coverage-audit-2026-10-12.md). Each one joins this list when its rework is
// committed, and from then on is held to the same rules as lessons 8 to 18. The list only grows.
const REWORKED = new Set(['history-mechanical-engines', 'history-aircraft-engines', 'terminologies', 'thermodynamic-cycles', 'classification']);
const held = (pack, lesson) => SYLLABUS_PACKS.includes(pack.id) || REWORKED.has(lesson.id);
// The accessories lesson was written before these rules: its steps carry no media plan and its checks are of two kinds. It is held to the
// rest of this file, but not yet to those two, until its rework (which then removes it from this list).
const NOT_YET_HELD_TO_STEP_AND_CHECK_RULES = new Set(['accessories-and-drives']);
const MAX_WORDS_PER_STEP = 150;
const MIN_CHECKS_PER_LESSON = 8;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson('web/lessons-manifest.json');
const packs = manifest.packs.map((path) => readJson(`web/${path.replace(/^\.\//, '')}`)).filter((pack) => pack.lessons.some((lesson) => held(pack, lesson)));
const lessons = packs.flatMap((pack) => pack.lessons.filter((lesson) => held(pack, lesson)).map((lesson) => ({ pack, lesson })));
const words = (text) => text.trim().split(/\s+/).length;

test('the syllabus packs that exist are valid and listed in the manifest in lesson order', () => {
  assert.ok(packs.length >= 2, 'expected the valve-train and breathing packs');
  for (const pack of packs) assert.deepEqual(validateLessonPack(pack), [], pack.id);
  const numbers = lessons.map(({ lesson }) => lesson.sequenceNumber);
  assert.ok(numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 18), `lesson numbers ${numbers}`);
  assert.deepEqual([...numbers].sort((a, b) => a - b), numbers, 'lessons run in order through the manifest');
  assert.equal(new Set(numbers).size, numbers.length, 'one lesson per number');
});

test('every lesson and course has its pictures, and every step names its sources and media plan', () => {
  for (const pack of packs) {
    for (const path of [pack.thumbnail, pack.banner]) assert.ok(path && existsSync(`web/${path.replace(/^\.\//, '')}`), `${pack.id}: course picture ${path}`);
    for (const { lesson } of lessons.filter((item) => item.pack === pack)) {
      const where = `${pack.id}/${lesson.id}`;
      if (NOT_YET_HELD_TO_STEP_AND_CHECK_RULES.has(lesson.id)) { assert.ok(lesson.thumbnail && existsSync(`web/${lesson.thumbnail.replace(/^\.\//, '')}`), `${where}: card thumbnail`); continue; }
      assert.ok(lesson.thumbnail && existsSync(`web/${lesson.thumbnail.replace(/^\.\//, '')}`), `${where}: card thumbnail`);
      for (const field of ['title', 'objective', 'completionCriteria']) assert.match(lesson[field] || '', /\S/, `${where}: ${field}`);
      assert.ok(lesson.steps.length >= 10, `${where}: a syllabus lesson has at least 10 steps, saw ${lesson.steps.length}`);
      for (const step of lesson.steps) {
        const at = `${where}/${step.title}`;
        assert.match(step.title || '', /\S/, `${where}: step title`);
        assert.ok(step.title.length <= 40, `${at}: keep step titles short for the step list`);
        assert.match(step.note || '', /\S/, `${at}: note`);
        assert.ok(step.sourceRefs?.length, `${at}: sourceRefs`);
        assert.ok(step.mediaPlan?.rationale, `${at}: mediaPlan`);
        assert.ok(words(step.prompt) <= MAX_WORDS_PER_STEP, `${at}: ${words(step.prompt)} words; split the step (limit ${MAX_WORDS_PER_STEP})`);
      }
    }
  }
});

test('every lesson has enough checks, of more than one kind, with a hint and a reason', () => {
  for (const { pack, lesson } of lessons) {
    if (NOT_YET_HELD_TO_STEP_AND_CHECK_RULES.has(lesson.id)) continue;
    const checks = pack.checks.filter((check) => check.lessonId === lesson.id);
    assert.ok(checks.length >= MIN_CHECKS_PER_LESSON, `${lesson.id}: ${checks.length} checks, expected at least ${MIN_CHECKS_PER_LESSON}`);
    assert.ok(new Set(checks.map((check) => check.type)).size >= 3, `${lesson.id}: use at least three question types`);
    for (const check of checks) {
      assert.match(check.rationale || '', /\S/, `${check.id}: rationale`);
      if (check.type !== 'numeric') continue;
      assert.match(check.hint || '', /\S/, `${check.id}: a calculation needs a hint`);
    }
    const hinted = checks.filter((check) => /\S/.test(check.hint || '')).length;
    assert.ok(hinted >= checks.length * 0.8, `${lesson.id}: most checks should carry a hint`);
  }
});

test('syllabus lessons do not claim a review the instructor has not made', () => {
  for (const { lesson } of lessons) {
    if (lesson.reviewStatus === 'reviewed') assert.match(lesson.reviewedOn || '', /^\d{4}-\d{2}-\d{2}$/, `${lesson.id}: reviewedOn`);
    else assert.equal(lesson.reviewStatus, 'unreviewed', lesson.id);
  }
});
