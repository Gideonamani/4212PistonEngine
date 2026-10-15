import assert from 'node:assert/strict';
import test from 'node:test';
import { CHIPS_COLLAPSED_LIMIT, CHIPS_MIN_PARTS, chipsOffered, spotlightFor, stepPartChips, toggleChip, visibleChips } from '../src/viewer/core/step-part-chips.mjs';

const components = [
  { id: 'IntakeValve', label: 'Intake valve' },
  { id: 'ExhaustValve', label: 'Exhaust valve' },
  { id: 'IntakeSeatInsert', label: 'Intake valve seat' },
  { id: 'PistonBody', label: 'Piston' },
];

test('a chip for each spotlit part, in the order the step names them, with the model\'s own label', () => {
  assert.deepEqual(stepPartChips(['ExhaustValve', 'IntakeValve'], components), [
    { id: 'ExhaustValve', label: 'Exhaust valve' },
    { id: 'IntakeValve', label: 'Intake valve' },
  ]);
});

test('a part the model does not list, or a part named twice, gets no chip', () => {
  assert.deepEqual(stepPartChips(['IntakeValve', 'Nonsense', 'IntakeValve', 'PistonBody'], components).map((chip) => chip.id), ['IntakeValve', 'PistonBody']);
});

test('no spotlight, or a model that has not loaded, gives no chips', () => {
  assert.deepEqual(stepPartChips(undefined, components), []);
  assert.deepEqual(stepPartChips([], components), []);
  assert.deepEqual(stepPartChips(['IntakeValve'], undefined), []);
});

test('a label that is empty falls back to the part\'s id rather than an empty chip', () => {
  assert.deepEqual(stepPartChips(['A'], [{ id: 'A', label: '' }]), [{ id: 'A', label: 'A' }]);
});

test('chips are offered from two parts up: one part has nothing to tell apart from', () => {
  assert.equal(CHIPS_MIN_PARTS, 2);
  assert.equal(chipsOffered([]), false);
  assert.equal(chipsOffered([{ id: 'a', label: 'A' }]), false);
  assert.equal(chipsOffered([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]), true);
});

const many = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, label: `Part ${index}` }));

test('a short row shows every chip', () => {
  assert.deepEqual(visibleChips(many.slice(0, CHIPS_COLLAPSED_LIMIT)), { shown: many.slice(0, CHIPS_COLLAPSED_LIMIT), hidden: 0 });
});

test('a long row shows the first few and counts the rest, until it is expanded', () => {
  const collapsed = visibleChips(many);
  assert.equal(collapsed.shown.length, CHIPS_COLLAPSED_LIMIT);
  assert.equal(collapsed.hidden, many.length - CHIPS_COLLAPSED_LIMIT);
  assert.deepEqual(collapsed.shown.map((chip) => chip.id), many.slice(0, CHIPS_COLLAPSED_LIMIT).map((chip) => chip.id));
  assert.deepEqual(visibleChips(many, { expanded: true }), { shown: many, hidden: 0 });
});

test('the chosen chip is never tucked away, even when it sits past the limit', () => {
  const { shown, hidden } = visibleChips(many, { selected: 'p9' });
  assert.ok(shown.some((chip) => chip.id === 'p9'));
  assert.equal(shown.length, CHIPS_COLLAPSED_LIMIT + 1);
  assert.equal(hidden, many.length - shown.length);
  assert.deepEqual(shown.map((chip) => chip.id), [...many.slice(0, CHIPS_COLLAPSED_LIMIT).map((chip) => chip.id), 'p9'], 'the order is the step\'s own');
});

test('a tap chooses a part, and a second tap on it lets go', () => {
  assert.equal(toggleChip(undefined, 'a'), 'a');
  assert.equal(toggleChip('a', 'b'), 'b');
  assert.equal(toggleChip('a', 'a'), undefined);
});

test('the spotlight is the chosen part alone, or the step\'s own parts when none is chosen', () => {
  assert.deepEqual(spotlightFor('b', ['a', 'b', 'c']), ['b']);
  assert.deepEqual(spotlightFor(undefined, ['a', 'b', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(spotlightFor(undefined, undefined), []);
  const own = ['a', 'b'];
  assert.notEqual(spotlightFor(undefined, own), own, 'the step\'s own list is copied, never handed out to be changed');
});
