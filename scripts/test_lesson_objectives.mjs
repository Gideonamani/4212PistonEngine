import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateLessonPack } from '../web/schema/content-schema.mjs';
import { outcomeTexts } from '../src/data/outcomes.mjs';
import { GUIDE_PATH, buildGuide, loadSyllabusLessons } from './build_objectives_guide.mjs';

// The instructor's purpose, core idea and learning outcomes for each of the 18 syllabus lessons (see docs/lesson-objectives.md).

const manifest = JSON.parse(fs.readFileSync('web/lessons-manifest.json', 'utf8'));
const packs = manifest.packs.map((file) => JSON.parse(fs.readFileSync(`web/${file.replace(/^\.\//, '')}`, 'utf8')));
const lessons = loadSyllabusLessons();

test('the syllabus is the 18 numbered lessons, once each', () => {
  assert.deepEqual(lessons.map((lesson) => lesson.sequenceNumber), Array.from({ length: 18 }, (_, index) => index + 1));
});

test('every syllabus lesson says what it is for and what a learner should be able to do', () => {
  for (const lesson of lessons) {
    const where = `lesson ${lesson.sequenceNumber} (${lesson.id})`;
    assert.ok(typeof lesson.purpose === 'string' && lesson.purpose.trim().length > 20, `${where}: purpose`);
    const texts = outcomeTexts(lesson.outcomes);
    assert.ok(texts.length >= 7, `${where}: has ${texts.length} outcomes`);
    assert.equal(new Set(texts).size, texts.length, `${where}: two outcomes read the same, so their ticks would collide`);
    for (const text of texts) assert.ok(/[.!?]$/.test(text.trim()), `${where}: "${text.slice(0, 40)}" should be a full sentence`);
  }
});

test('the practicals lesson is organised as its three practical exercises', () => {
  const practicals = lessons.find((lesson) => lesson.id === 'practicals');
  const headings = practicals.outcomes.filter((entry) => typeof entry === 'object').map((entry) => entry.heading);
  assert.equal(headings.length, 3);
  assert.deepEqual(headings.map((heading) => heading.slice(0, 11)), ['Practical A', 'Practical B', 'Practical C']);
});

test('the pack schema accepts the objectives as written', () => {
  for (const pack of packs) assert.deepEqual(validateLessonPack(pack), [], pack.id);
});

test('the pack schema refuses objectives that are malformed', () => {
  const base = structuredClone(packs[0]);
  const problems = (change) => {
    const pack = structuredClone(base);
    change(pack.lessons[0]);
    return validateLessonPack(pack);
  };
  assert.match(problems((lesson) => { lesson.purpose = ''; }).join('\n'), /purpose/);
  assert.match(problems((lesson) => { lesson.coreIdea = 7; }).join('\n'), /coreIdea/);
  assert.match(problems((lesson) => { lesson.syllabusNote = ['x']; }).join('\n'), /syllabusNote/);
  assert.match(problems((lesson) => { lesson.outcomes = 'Explain it.'; }).join('\n'), /outcomes must be an array/);
  assert.match(problems((lesson) => { lesson.outcomes = ['Fine.', '  ']; }).join('\n'), /outcomes\[1\]/);
  assert.match(problems((lesson) => { lesson.outcomes = [{ heading: 'No items', items: [] }]; }).join('\n'), /outcomes\[0\]/);
  assert.match(problems((lesson) => { lesson.outcomes = [{ items: ['No heading.'] }]; }).join('\n'), /outcomes\[0\]/);
  assert.match(problems((lesson) => { lesson.outcomes = ['Same.', 'Same.']; }).join('\n'), /same outcome twice/i);
  assert.deepEqual(problems((lesson) => { lesson.outcomes = ['One.', { heading: 'Group', note: 'A note.', items: ['Two.'] }]; }), []);
});

test('the storyline names every syllabus lesson exactly once', () => {
  const storyline = JSON.parse(fs.readFileSync('data/curriculum-storyline.json', 'utf8'));
  assert.deepEqual(storyline.steps.map((step) => step.lessonId).sort(), lessons.map((lesson) => lesson.id).sort());
  for (const step of storyline.steps) assert.ok(step.label && step.question, step.lessonId);
});

test('docs/lesson-objectives.md is the page the packs generate', () => {
  const onDisk = fs.readFileSync(GUIDE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, buildGuide(), 'run: node scripts/build_objectives_guide.mjs');
});
