import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { hasBrokenPartLink, partLinkIds, plainText, textSegments } from '../web/schema/part-links.mjs';
import { toParagraphs } from '../src/components/lesson/paragraphs.mjs';

// Words in a step's text linked to a part, "[intake valve](IntakeValve)". The schema test holds each link to the step's own spotlit parts;
// this pins how the text is read, and checks that the lesson page's paragraph splitting never cuts a link in two.

test('text is cut into plain runs and linked words, in order', () => {
  assert.deepEqual(textSegments('Open the [intake valve](IntakeValve), then the [exhaust valve](ExhaustValve).'), [
    { text: 'Open the ' }, { text: 'intake valve', part: 'IntakeValve' }, { text: ', then the ' }, { text: 'exhaust valve', part: 'ExhaustValve' }, { text: '.' },
  ]);
  assert.deepEqual(textSegments('[Valve](IntakeValve)'), [{ text: 'Valve', part: 'IntakeValve' }], 'a link alone is one segment');
  assert.deepEqual(textSegments('No links here.'), [{ text: 'No links here.' }]);
  assert.deepEqual(textSegments(''), [{ text: '' }], 'empty text is one empty run');
});

test('the ids linked and the plain words', () => {
  const text = 'The [pin](FloatingPin) joins the [rod](ConnectingRodBody) to the [pin](FloatingPin) bosses.';
  assert.deepEqual(partLinkIds(text), ['FloatingPin', 'ConnectingRodBody', 'FloatingPin']);
  assert.equal(plainText(text), 'The pin joins the rod to the pin bosses.');
  assert.equal(plainText('Square [brackets] and (parentheses) stay.'), 'Square [brackets] and (parentheses) stay.');
});

test('a link written the wrong way is caught, and ordinary brackets are not', () => {
  for (const broken of ['the [valve] (IntakeValve)', 'the [valve](Intake Valve)', 'the [valve](1Valve)', 'the [](IntakeValve)']) assert.ok(hasBrokenPartLink(broken), broken);
  for (const fine of ['the [valve](IntakeValve)', 'clearance [hot] is larger', 'the valve (intake) opens', '']) assert.equal(hasBrokenPartLink(fine), false, fine);
});

test('no lesson\'s paragraphs cut a link in two', () => {
  const prompts = fs.readdirSync('web').filter((name) => name.endsWith('-lessons.json')).flatMap((name) =>
    JSON.parse(fs.readFileSync(`web/${name}`, 'utf8')).lessons.flatMap((lesson) => lesson.steps.map((step, index) => ({ where: `${name} ${lesson.id} step ${index + 1}`, prompt: step.prompt ?? '' }))));
  for (const { where, prompt } of prompts) {
    assert.deepEqual(toParagraphs(prompt).flatMap(partLinkIds), partLinkIds(prompt), where);
  }
  // The splitter itself, on a long text with a link at a sentence end and one holding an abbreviation.
  const long = `${'The engine turns. '.repeat(12)}Watch the [No. 1 intake valve](IntakeValve). ${'It lifts and closes. '.repeat(12)}Then the [exhaust valve](ExhaustValve).`;
  assert.ok(toParagraphs(long).length > 1, 'the long text is split');
  assert.deepEqual(toParagraphs(long).flatMap(partLinkIds), ['IntakeValve', 'ExhaustValve']);
});
