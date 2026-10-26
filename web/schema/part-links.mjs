// Words in a lesson step's text that name a part: "[intake valve](IntakeValve) opens". A learner taps the words to see that part alone
// in the 3D view, the way a part chip does. The link carries the part's id explicitly, because a word such as "valve" names several parts.
// Plain JavaScript with no imports, so the schema check, the lesson page and the Node tests read the text the same way.

/** `[words](PartId)`: the words shown, then the id of one of the step's spotlit parts. */
const PART_LINK = /\[([^[\]\n]+)\]\(([A-Za-z][\w-]*)\)/g;

/**
 * The text cut into the plain runs and the linked words, in order. Text with no links is one plain run.
 * @param {string} text
 * @returns {{ text: string, part?: string }[]}
 */
export function textSegments(text) {
  const source = String(text ?? '');
  const segments = [];
  let from = 0;
  for (const match of source.matchAll(PART_LINK)) {
    if (match.index > from) segments.push({ text: source.slice(from, match.index) });
    segments.push({ text: match[1], part: match[2] });
    from = match.index + match[0].length;
  }
  if (from < source.length || !segments.length) segments.push({ text: source.slice(from) });
  return segments;
}

/** The part ids the text links to, in order (a part linked twice is listed twice). */
export const partLinkIds = (text) => [...String(text ?? '').matchAll(PART_LINK)].map((match) => match[2]);

/** The text as it reads with the links taken out, for anywhere that shows it as plain words. */
export const plainText = (text) => String(text ?? '').replace(PART_LINK, '$1');

/** Whether the text still has something that looks like a link once the real links are taken out: a typo such as "[valve] (Id)". */
export const hasBrokenPartLink = (text) => /\]\s*\(|\[[^\]\n]*\]\(/.test(plainText(text));
