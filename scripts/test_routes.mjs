import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRoute, parseHash, resolveLearn } from '../src/routes/route.mjs';

test('the top-level views', () => {
  assert.deepEqual(parseHash('#/explore'), { view: 'explore' });
  assert.deepEqual(parseHash('#/check'), { view: 'check' });
  assert.deepEqual(parseHash('#/learn'), { view: 'learn' });
  for (const hash of ['', '#', '#/', '#/nonsense', '#/learner', 'explore']) assert.equal(parseHash(hash).view, 'explore', hash);
});

test('learn routes read course, lesson and step', () => {
  assert.deepEqual(parseHash('#/learn/history-and-fundamentals'), { view: 'learn', course: 'history-and-fundamentals' });
  assert.deepEqual(parseHash('#/learn/c/l/step/4'), { view: 'learn', course: 'c', lesson: 'l', step: 4 });
  assert.deepEqual(parseHash('#/learn/c/l/complete'), { view: 'learn', course: 'c', lesson: 'l', complete: true });
  assert.deepEqual(parseHash('#/learn/c/l'), { view: 'learn', course: 'c', lesson: 'l' });
});

test('bad step numbers become step 1 instead of NaN', () => {
  for (const bad of ['abc', '0', '-3', '', 'NaN']) assert.equal(parseHash(`#/learn/c/l/step/${bad}`).step, 1, bad);
  assert.equal(parseHash('#/learn/c/l/step').step, 1);
  assert.equal(parseHash('#/learn/c/l/step/2.9').step, 2);
});

test('a lesson needs a course, and empty segments are ignored', () => {
  assert.deepEqual(parseHash('#/learn//l/step/2'), { view: 'learn' });
  assert.deepEqual(parseHash('#/learn/c//step/2'), { view: 'learn', course: 'c' });
});

test('encoded ids round-trip and malformed encoding does not throw', () => {
  const route = { view: 'learn', course: 'a b/c', lesson: 'x&y', step: 3 };
  assert.deepEqual(parseHash(formatRoute(route)), route);
  assert.doesNotThrow(() => parseHash('#/learn/%E0%A4%A/l/step/1'));
});

test('format and parse are inverse for every shape of route', () => {
  const routes = [
    { view: 'explore' }, { view: 'check' }, { view: 'learn' },
    { view: 'learn', course: 'c' },
    { view: 'learn', course: 'c', lesson: 'l' },
    { view: 'learn', course: 'c', lesson: 'l', step: 1 },
    { view: 'learn', course: 'c', lesson: 'l', step: 12 },
    { view: 'learn', course: 'c', lesson: 'l', complete: true },
  ];
  for (const route of routes) assert.deepEqual(parseHash(formatRoute(route)), route, formatRoute(route));
  assert.equal(formatRoute({ view: 'learn', course: 'c', lesson: 'l', step: 5 }), '#/learn/c/l/step/5');
  assert.equal(formatRoute({ view: 'learn', lesson: 'l' }), '#/learn', 'a lesson without a course is dropped');
});

test('resolveLearn finds listed lessons and deep dives, and nothing for an unknown id', () => {
  const tracks = [
    { id: 'c1', lessons: [{ id: 'a' }, { id: 'b' }], deepDives: [{ id: 'dd' }] },
    { id: 'c2', lessons: [{ id: 'z' }] },
  ];
  assert.equal(resolveLearn(tracks, { view: 'learn', course: 'c1', lesson: 'b' }).lesson.id, 'b');
  assert.equal(resolveLearn(tracks, { view: 'learn', course: 'c1', lesson: 'dd' }).lesson.id, 'dd');
  assert.equal(resolveLearn(tracks, { view: 'learn', course: 'c1' }).track.id, 'c1');
  assert.equal(resolveLearn(tracks, { view: 'learn', course: 'c1' }).lesson, undefined);
  assert.equal(resolveLearn(tracks, { view: 'learn', course: 'c2', lesson: 'a' }).lesson, undefined, 'lessons belong to their own course');
  assert.equal(resolveLearn(tracks, { view: 'learn', course: 'nope' }).track, undefined);
  assert.deepEqual(resolveLearn(tracks, { view: 'explore' }), {});
});
