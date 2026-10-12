// Paragraphs for reading a lesson step. The step text is one string in the lesson pack. An author who wants control puts a blank line where
// a paragraph should end. Text with no breaks of its own is split at sentence ends, a couple of sentences at a time, so a long step does not
// arrive as one solid block. Plain JavaScript so a Node test can pin it against the real lessons.

/** Text up to this long stays a single paragraph: a short step does not need splitting. */
export const SHORT_TEXT = 300;
/** A paragraph is closed once adding the next sentence would take it past this many characters. */
export const PARAGRAPH_TARGET = 260;
/** A last paragraph shorter than this is folded into the one before it, so a step never ends on a stranded half-line. */
const STRANDED = 70;

// Words that end in a full stop without ending a sentence ("e.g. the", "No. 1", "approx. 5 mm").
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'approx', 'no', 'nos', 'fig', 'figs', 'cf', 'dr', 'mr', 'mrs', 'st', 'al', 'ca', 'inc', 'ltd', 'max', 'min', 'ref', 'refs', 'eq', 'vol', 'p', 'pp', 'sec', 'ch']);

const endsAbbreviation = (head) => {
  const word = head.match(/([A-Za-z](?:[A-Za-z.]*[A-Za-z])?)\.$/)?.[1];
  if (!word) return false;
  return ABBREVIATIONS.has(word.toLowerCase()) || /^[A-Z]$/.test(word); // a lone capital is an initial
};

/** The sentences of a text, in order, with their spacing removed. */
export function sentencesOf(text) {
  const pieces = text.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“"'‘(\[])/);
  const sentences = [];
  for (const piece of pieces) {
    if (sentences.length && endsAbbreviation(sentences[sentences.length - 1])) sentences[sentences.length - 1] += ` ${piece}`;
    else sentences.push(piece);
  }
  return sentences;
}

/** The paragraphs to show for a step's text. Never returns an empty list. */
export function toParagraphs(text) {
  const clean = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return [''];

  // The author's own breaks are respected exactly.
  const authored = clean.split(/\n\s*\n/).map((part) => part.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (authored.length > 1) return authored;
  if (clean.length <= SHORT_TEXT) return [clean.replace(/\s*\n\s*/g, ' ')];

  const paragraphs = [];
  let current = '';
  for (const sentence of sentencesOf(clean.replace(/\s*\n\s*/g, ' '))) {
    if (current && current.length + 1 + sentence.length > PARAGRAPH_TARGET) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) {
    if (paragraphs.length && current.length < STRANDED) paragraphs[paragraphs.length - 1] += ` ${current}`;
    else paragraphs.push(current);
  }
  return paragraphs;
}
