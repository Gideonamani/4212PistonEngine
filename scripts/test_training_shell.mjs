import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL(`../web/${name}`, import.meta.url), 'utf8');

const explore = read('explore.html');
const learn = read('learn.html');
const check = read('check.html');
const shellCss = read('shell.css');
const pageShell = read('page-shell.mjs');
const guidedShared = read('guided-shared.mjs');
const learnModes = read('learn-modes.mjs');
const checkModes = read('check-modes.mjs');
const exploreRouter = read('explore-router.mjs');

// Explore/Learn/Check are separate pages now; each marks itself current in its own nav
// and links to the other two (docs/mode-shell-viewer-separation.md).
assert.match(explore, /data-training-mode="explore" href="\.\/explore\.html" aria-selected="true"/);
assert.match(learn, /data-training-mode="learn" href="\.\/learn\.html" aria-selected="true"/);
assert.match(check, /data-training-mode="check" href="\.\/check\.html" aria-selected="true"/);

// shared dialog/settings chrome exists on every page; the appearance toggle is Explore-only
for (const html of [explore, learn, check]) for (const id of ['settings-dialog', 'about-dialog', 'reduced-motion']) assert.match(html, new RegExp(`id="${id}"`));
assert.match(explore, /id="settings-inspection"/);
assert.doesNotMatch(learn, /id="settings-inspection"/);
assert.doesNotMatch(check, /id="settings-inspection"/);
assert.match(explore, /M12 2v2m0 16v2/); // restrained eight-spoke settings icon
assert.match(shellCss, /dialog-close::before/);

// every page loads the one shared stylesheet and wires its dialogs/nav via page-shell.mjs
for (const html of [explore, learn, check]) assert.match(html, /href="\.\/shell\.css"/);
for (const script of [exploreRouter, learnModes, checkModes]) assert.match(script, /from '\.\/page-shell\.mjs'/);

// Learn and Check share lesson-pack loading and the generic step renderer rather than
// each re-implementing it
assert.match(learnModes, /from '\.\/guided-shared\.mjs'/);
assert.match(checkModes, /from '\.\/guided-shared\.mjs'/);

// guided progress and prediction copy are wired
assert.match(learnModes, /Step \$\{step \+ 1\}\/\$\{lesson\.steps\.length\}/);
assert.match(guidedShared, /Make your prediction first/);
assert.match(checkModes, /next\.disabled = true/);
assert.match(learnModes, /Reveal observation/);
assert.match(checkModes, /Need a hint/);

// Check yourself's Training mode locks on first answer, no retry - per
// docs/lesson-and-assessment-architecture.md ("once an option is selected, it locks
// immediately"). Regression-guard against the old retry-until-correct behavior.
assert.match(checkModes, /correct answer is highlighted/);
assert.match(checkModes, /btn-incorrect/);
assert.doesNotMatch(checkModes, /Try another answer/);
assert.doesNotMatch(checkModes, /Try another order/);

// Learn/Check must never import Explore's Three.js-heavy viewer code directly - only a
// model-pose step's lazy engine-core.mjs import may pull Three.js in, and only then
for (const src of [learnModes, checkModes, guidedShared, pageShell]) assert.doesNotMatch(src, /viewer\.js|engine-training-adapter\.mjs|from ['"]three['"]/);

console.log('page shell, guided progress, retry feedback and shared overlays are wired');
