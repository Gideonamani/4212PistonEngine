import assert from 'node:assert/strict';
import test from 'node:test';
import { outcomeKey, outcomeSections, outcomeTexts } from '../src/data/outcomes.mjs';

// A lesson's outcomes: how a list of sentences and headed groups becomes sections, and the key a learner's tick is kept under.

test('plain sentences form one section without a heading', () => {
  assert.deepEqual(outcomeSections(['One.', 'Two.']), [{ items: ['One.', 'Two.'] }]);
  assert.deepEqual(outcomeSections(undefined), []);
  assert.deepEqual(outcomeSections([]), []);
});

test('a headed group becomes its own section, and sentences around it keep their order', () => {
  const sections = outcomeSections(['Before.', { heading: 'Practical A', note: 'On the trainer.', items: ['A1.', 'A2.'] }, { heading: 'Practical B', items: ['B1.'] }, 'After.']);
  assert.deepEqual(sections, [
    { items: ['Before.'] },
    { heading: 'Practical A', note: 'On the trainer.', items: ['A1.', 'A2.'] },
    { heading: 'Practical B', items: ['B1.'] },
    { items: ['After.'] },
  ]);
  assert.deepEqual(outcomeTexts(['Before.', { heading: 'H', items: ['A1.'] }, 'After.']), ['Before.', 'A1.', 'After.']);
});

test('the sections are copies: showing them can never change the lesson', () => {
  const group = { heading: 'H', items: ['A1.'] };
  outcomeSections([group])[0].items.push('extra');
  assert.deepEqual(group.items, ['A1.']);
});

test('an outcome key is stable, ignores spacing, and tells different sentences apart', () => {
  assert.equal(outcomeKey('Explain the purpose of an engine.'), outcomeKey('  Explain  the purpose\nof an engine. '));
  assert.notEqual(outcomeKey('Explain the purpose of an engine.'), outcomeKey('Explain the purpose of the engine.'));
  assert.match(outcomeKey('anything'), /^[0-9a-f]{8}$/);
  assert.equal(outcomeKey('Compute 2 → 3'), outcomeKey('Compute 2 → 3'), 'characters outside ASCII are fine');
});
