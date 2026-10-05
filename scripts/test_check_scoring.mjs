import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANSWERABLE_TYPES, describeNumericAnswer, formatNumber, initialAnswer, isAnswered, isCorrect, matchingOptions, matchingResults, parseNumber, shuffled, withinTolerance,
} from '../src/components/check/scoring.mjs';

const choice = { type: 'multiple-choice', options: ['a', 'b', 'c'], correctIndex: 1 };
const ordering = { type: 'ordering', items: ['intake', 'compression', 'power', 'exhaust'] };
const matching = { type: 'matching', pairs: [{ left: 'Magneto', right: 'Spark' }, { left: 'Vacuum pump', right: 'Gyro instruments' }, { left: 'Oil pump', right: 'Lubrication' }] };
const numeric = { type: 'numeric', unit: 'cu in', correctValue: 78.5, tolerance: 0.5 };

test('the answerable types are the four the screen has an answer area for', () => {
  assert.deepEqual([...ANSWERABLE_TYPES], ['multiple-choice', 'ordering', 'matching', 'numeric']);
});

test('numbers are read the way a student types them', () => {
  assert.equal(parseNumber('78.5'), 78.5);
  assert.equal(parseNumber('  9 '), 9);
  assert.equal(parseNumber('33,000'), 33000);
  assert.equal(parseNumber('1,234,567.5'), 1234567.5);
  assert.equal(parseNumber('-4'), -4);
  assert.equal(parseNumber('−4.5'), -4.5, 'the typographic minus is accepted');
  assert.equal(parseNumber('.5'), 0.5);
  assert.equal(parseNumber('5.'), 5);
  assert.equal(parseNumber('1 000'), 1000, 'spaces are ignored');
  for (const notANumber of ['', '   ', 'abc', '1,5', '12 hp', '1.2.3', '--3', '0x10', '1e3', '9:1', undefined, null, 7]) assert.equal(parseNumber(notANumber), null, `${JSON.stringify(notANumber)} is not a number`);
});

test('numeric answers are marked within the tolerance, edges included', () => {
  assert.equal(isCorrect(numeric, '78.5'), true);
  assert.equal(isCorrect(numeric, '78'), true);
  assert.equal(isCorrect(numeric, '79'), true);
  assert.equal(isCorrect(numeric, '79.1'), false);
  assert.equal(isCorrect(numeric, '77.9'), false);
  assert.equal(isCorrect(numeric, 'seventy-eight'), false);
  assert.equal(isCorrect(numeric, ''), false);
  const exact = { type: 'numeric', unit: ':1', correctValue: 9 };
  assert.equal(isCorrect(exact, '9'), true);
  assert.equal(isCorrect(exact, '9.0'), true);
  assert.equal(isCorrect(exact, '9.01'), false, 'no tolerance means exact');
  assert.equal(withinTolerance(0.1 + 0.2, 0.3, 0), true, 'floating-point noise is not a wrong answer');
  assert.equal(withinTolerance(170, 170, 0), true);
});

test('a numeric answer can be verified only when it is a number', () => {
  assert.equal(isAnswered(numeric, ''), false);
  assert.equal(isAnswered(numeric, 'abc'), false);
  assert.equal(isAnswered(numeric, '12'), true);
});

test('multiple choice is marked by index', () => {
  assert.equal(isAnswered(choice, undefined), false);
  assert.equal(isAnswered(choice, 0), true, 'the first option is an answer');
  assert.equal(isCorrect(choice, 1), true);
  assert.equal(isCorrect(choice, 0), false);
  assert.equal(isCorrect(choice, undefined), false);
});

test('ordering is marked by position and never starts in the right order', () => {
  assert.equal(isCorrect(ordering, [...ordering.items]), true);
  assert.equal(isCorrect(ordering, ['compression', 'intake', 'power', 'exhaust']), false);
  assert.equal(isCorrect(ordering, ordering.items.slice(0, 3)), false, 'a short list is wrong');
  for (let run = 0; run < 200; run += 1) assert.notDeepEqual(initialAnswer(ordering), ordering.items, 'the start order must not give the answer');
  assert.deepEqual([...shuffled(ordering.items)].sort(), [...ordering.items].sort(), 'a shuffle keeps every item');
  assert.deepEqual(shuffled(['only']), ['only']);
  assert.equal(isAnswered(ordering, initialAnswer(ordering)), true);
});

test('matching is marked pair by pair and needs every term matched before it can be verified', () => {
  assert.deepEqual(initialAnswer(matching), ['', '', '']);
  assert.equal(isAnswered(matching, ['Spark', '', 'Lubrication']), false);
  assert.equal(isAnswered(matching, ['Spark', 'Gyro instruments', 'Lubrication']), true);
  assert.equal(isCorrect(matching, ['Spark', 'Gyro instruments', 'Lubrication']), true);
  assert.equal(isCorrect(matching, ['Spark', 'Lubrication', 'Gyro instruments']), false);
  assert.deepEqual(matchingResults(matching, ['Spark', 'Lubrication', 'Lubrication']), [true, false, true]);
  assert.deepEqual(matchingResults(matching, ['', '', '']), [false, false, false]);
});

test('the matching options are in a fixed alphabetical order that does not follow the pairs', () => {
  assert.deepEqual(matchingOptions(matching), ['Gyro instruments', 'Lubrication', 'Spark']);
  assert.notDeepEqual(matchingOptions(matching), matching.pairs.map((pair) => pair.right), 'the order must not mirror the question');
});

test('numbers are shown as a student expects to read them', () => {
  assert.equal(formatNumber(33000), '33,000');
  assert.equal(formatNumber(78.5398), '78.5398');
  assert.equal(formatNumber(9), '9');
  assert.equal(describeNumericAnswer({ unit: 'hp', correctValue: 170, tolerance: 0 }), '170 hp');
  assert.equal(describeNumericAnswer({ unit: 'hp', correctValue: 170 }), '170 hp');
  assert.equal(describeNumericAnswer(numeric), '78.5 cu in (accepted within ±0.5 cu in)');
});
