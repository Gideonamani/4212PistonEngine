// Text splicing for hand-formatted lesson packs: find a JSON array by key and indent, list its elements, and rebuild it, leaving every other byte alone.
export function closeOf(text, open) {
  let depth = 0;
  let inString = false;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (inString) { if (c === '\\') i += 1; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth += 1;
    else if (c === ']' || c === '}') { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('unbalanced');
}

/** The array under `key` whose key line starts with `indent` spaces, searched from `from`. Returns offsets and element texts. */
export function arrayAt(text, key, indent, from = 0) {
  const pattern = new RegExp(`^ {${indent}}"${key}": \\[`, 'm');
  const sub = text.slice(from);
  const match = pattern.exec(sub);
  if (!match) throw new Error(`no "${key}" array at indent ${indent}`);
  const open = from + match.index + match[0].length - 1;
  const close = closeOf(text, open);
  const spans = [];
  let depth = 0;
  let inString = false;
  let start = -1;
  for (let i = open + 1; i < close; i += 1) {
    const c = text[i];
    if (inString) { if (c === '\\') i += 1; else if (c === '"') inString = false; continue; }
    if (c === '"') { inString = true; if (depth === 0 && start < 0) start = i; continue; }
    if (c === '[' || c === '{') { if (depth === 0 && start < 0) start = i; depth += 1; continue; }
    if (c === ']' || c === '}') { depth -= 1; if (depth === 0) { spans.push([start, i + 1]); start = -1; } continue; }
  }
  const elements = spans.map(([s, e]) => text.slice(s, e));
  const separator = spans.length > 1 ? text.slice(spans[0][1], spans[1][0]) : null;
  return { open, close, spans, elements, separator, first: spans[0]?.[0], last: spans.at(-1)?.[1] };
}

/** An object as pretty JSON that continues at `indent` spaces and uses the file's line ending. */
export const serialize = (value, indent, eol) => JSON.stringify(value, null, 2).replace(/\n/g, `${eol}${' '.repeat(indent)}`);
