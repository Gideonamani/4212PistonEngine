// Covers the unified Explore/Learn/Check shell's content model: lessons-manifest.json
// must list every track pack, each pack must carry the gallery metadata a track card
// needs (id/title/description), and the check-gallery derivation (scan every pack's
// checks[] for distinct lessonIds) must actually surface checks from every pack -
// history-lessons.json's 6 checks were previously unreachable by any UI before this.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateLessonPack } from '../web/schema/content-schema.mjs';

const readJson = name => JSON.parse(fs.readFileSync(new URL(`../web/${name}`, import.meta.url), 'utf8'));

const manifest = readJson('lessons-manifest.json');
assert.deepEqual(manifest.packs, ['./history-lessons.json', './fundamentals-lessons.json', './m2-cylinder-lessons.json']);

const packs = manifest.packs.map(url => readJson(url.replace('./', '')));
const packIds = packs.map(pack => pack.id);
assert.deepEqual(packIds, ['history-and-fundamentals', 'fundamentals-and-classification', 'm2-cylinder-study']);
assert.equal(new Set(packIds).size, packIds.length, 'track ids must be unique across packs');

for (const pack of packs) {
  assert.match(pack.id, /\S/, 'every manifest pack needs a track id for gallery navigation');
  assert.match(pack.title, /\S/, 'every manifest pack needs a track title for the gallery card');
  assert.match(pack.description, /\S/, 'every manifest pack needs a track description for the gallery card');
  assert.deepEqual(validateLessonPack(pack), []);
}

// Lesson ids must be globally unique across all packs - the unified shell addresses a
// lesson by id alone in its ?lesson=/?check= URL params, with no separate pack param.
const allLessonIds = packs.flatMap(pack => pack.lessons.map(lesson => lesson.id));
assert.equal(new Set(allLessonIds).size, allLessonIds.length, 'lesson ids must be unique across every pack in the manifest');

// The Check gallery lists every lesson that owns at least one check, across all packs -
// this is the exact derivation the React assessment gallery performs.
// Students see listed lessons and the deep dives a step links to; parked drafts (listed:false, not linked) stay hidden
// together with their checks (see src/data/loadProductionData.ts).
const isVisible = (pack, lesson) => lesson.listed !== false
  || pack.lessons.some(other => other.steps.some(step => (step.deepDiveLinks || []).includes(lesson.id)));
const lessonsWithChecks = packs.flatMap(pack =>
  pack.lessons.filter(lesson => isVisible(pack, lesson) && (pack.checks || []).some(item => item.lessonId === lesson.id)).map(lesson => ({ lesson, pack })));
assert.equal(lessonsWithChecks.length, 9, 'expected 3 history + 5 fundamentals (3 listed lessons + 2 deep dives) + 1 M2 lessons to each own at least one check');
const historyChecks = lessonsWithChecks.filter(({ pack }) => pack.id === 'history-and-fundamentals');
assert.equal(historyChecks.length, 3, 'all 3 history lessons must be reachable from the Check gallery, not just the M2 lesson');
const fundamentalsChecks = lessonsWithChecks.filter(({ pack }) => pack.id === 'fundamentals-and-classification');
assert.equal(fundamentalsChecks.length, 5, 'the 3 listed fundamentals lessons and 2 deep dives must be reachable from the Check gallery');

console.log('unified gallery data model is valid: manifest lists every track, ids are unique, all packs\' checks are reachable');
