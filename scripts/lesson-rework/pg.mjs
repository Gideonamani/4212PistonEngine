// Usage: node scripts/lesson-rework/pg.mjs <txt file> <pdf page numbers, comma separated> [context phrase filter]
// Prints the text of the given 1-based PDF pages (form-feed separated file), whitespace collapsed to paragraphs.
// Or: node pg.mjs <txt file> grep <phrase> [width] -> prints each hit with the page number and surrounding text
import fs from 'node:fs';
const [file, what, arg, width = '400'] = process.argv.slice(2);
const pages = fs.readFileSync(file, 'utf8').split('\f');
if (what === 'grep') {
  const wanted = arg.toLowerCase();
  pages.forEach((page, index) => {
    const flat = page.replace(/\s+/g, ' ');
    let from = 0;
    for (;;) {
      const at = flat.toLowerCase().indexOf(wanted, from);
      if (at < 0) break;
      console.log(`p${index + 1}: ...${flat.slice(Math.max(0, at - Number(width) / 2), at + Number(width) / 2)}...`);
      from = at + wanted.length;
    }
  });
} else {
  for (const n of what.split(',')) console.log(`===== PDF p. ${n} =====\n${pages[Number(n) - 1]}`);
}
