// Usage: node scripts/lesson-rework/findpage.mjs <text file split by form feeds> <phrase> [<phrase> ...]  -> prints the 1-based PDF page of each phrase (whitespace-insensitive)
import fs from 'node:fs';
const [file, ...phrases] = process.argv.slice(2);
const pages = fs.readFileSync(file, 'utf8').split('\f').map((page) => page.replace(/\s+/g, ' '));
for (const phrase of phrases) {
  const wanted = phrase.replace(/\s+/g, ' ').toLowerCase();
  const hits = pages.map((page, index) => (page.toLowerCase().includes(wanted) ? index + 1 : 0)).filter(Boolean);
  console.log(`${phrase}: ${hits.join(', ') || 'not found'}`);
}
