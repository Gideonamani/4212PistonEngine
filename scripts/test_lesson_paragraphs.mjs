import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PARAGRAPH_TARGET, SHORT_TEXT, sentencesOf, toParagraphs } from '../src/components/lesson/paragraphs.mjs';

// How a step's text is broken into paragraphs for reading: the author's blank lines when there are any, otherwise sentence ends.

const squash = (text) => text.replace(/\s+/g, ' ').trim();

test('a blank line the author wrote is a paragraph break, and nothing else is added', () => {
  assert.deepEqual(toParagraphs('First thought.\n\nSecond thought.\r\n\r\n  \nThird.'), ['First thought.', 'Second thought.', 'Third.']);
  // A long text with the author's own breaks is not split again.
  const long = `${'A sentence of reasonable length goes here. '.repeat(10)}\n\nShort end.`;
  assert.equal(toParagraphs(long).length, 2);
});

test('a short text stays whole, and an empty one still gives something to render', () => {
  const short = 'Air is collected by a scoop. It passes a filter. Then it reaches the fuel metering device.';
  assert.ok(short.length <= SHORT_TEXT);
  assert.deepEqual(toParagraphs(short), [short]);
  assert.deepEqual(toParagraphs(''), ['']);
  assert.deepEqual(toParagraphs(undefined), ['']);
  assert.deepEqual(toParagraphs('One line\nbroken by a single newline.'), ['One line broken by a single newline.']);
});

test('a long text with no breaks is split at sentence ends, a couple of sentences at a time', () => {
  const sentence = (n) => `This is sentence number ${n}, written long enough to look like a real teaching sentence.`;
  const text = Array.from({ length: 9 }, (_, index) => sentence(index + 1)).join(' ');
  const paragraphs = toParagraphs(text);
  assert.ok(paragraphs.length >= 3, 'nine sentences become several paragraphs');
  for (const paragraph of paragraphs) {
    assert.ok(paragraph.length <= PARAGRAPH_TARGET + sentence(9).length, 'no paragraph is a wall');
    assert.match(paragraph, /\.$/, 'each paragraph ends at the end of a sentence');
  }
  assert.equal(paragraphs.join(' '), text, 'no word is lost or changed');
});

test('a full stop that is not the end of a sentence does not end a paragraph', () => {
  assert.deepEqual(sentencesOf('The pilot sets, e.g. 2,400 rpm. Cylinder No. 3 runs hot. See Fig. 4 for the chart. It rose 0.5 in. of mercury! Then what?'), [
    'The pilot sets, e.g. 2,400 rpm.',
    'Cylinder No. 3 runs hot.',
    'See Fig. 4 for the chart.',
    'It rose 0.5 in. of mercury!',
    'Then what?',
  ]);
  assert.deepEqual(sentencesOf('Made by J. R. Smith in 1903. The engine ran.'), ['Made by J. R. Smith in 1903.', 'The engine ran.']);
});

test('a last sentence too short to stand alone joins the paragraph before it', () => {
  const body = `${'x'.repeat(100)}. ${'y'.repeat(100)}. ${'z'.repeat(100)}.`;
  const paragraphs = toParagraphs(`${body} Done.`);
  assert.ok(!paragraphs.includes('Done.'));
  assert.ok(paragraphs.at(-1).endsWith('Done.'));
});

test('every step of every lesson keeps all of its words and loses none to the splitting', () => {
  const manifest = JSON.parse(fs.readFileSync('web/lessons-manifest.json', 'utf8'));
  let steps = 0;
  let split = 0;
  for (const file of manifest.packs) {
    const pack = JSON.parse(fs.readFileSync(`web/${file.replace(/^\.\//, '')}`, 'utf8'));
    for (const lesson of pack.lessons) {
      for (const [index, step] of lesson.steps.entries()) {
        const where = `${lesson.id} step ${index + 1}`;
        const paragraphs = toParagraphs(step.prompt);
        steps += 1;
        if (paragraphs.length > 1) split += 1;
        assert.ok(paragraphs.every((paragraph) => paragraph.length > 0), `${where}: an empty paragraph`);
        assert.equal(squash(paragraphs.join(' ')), squash(step.prompt), `${where}: words changed`);
      }
    }
  }
  assert.ok(steps > 200 && split > 100, `expected the real lessons to be read (${steps} steps, ${split} split)`);
});
