import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../web/training.html', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../web/model-router.mjs', import.meta.url), 'utf8');
const modes = fs.readFileSync(new URL('../web/training-modes.mjs', import.meta.url), 'utf8');
for (const mode of ['explore', 'learn', 'check']) assert.match(html, new RegExp(`data-training-mode="${mode}"`));
for (const id of ['settings-dialog', 'about-dialog', 'reduced-motion', 'settings-inspection']) assert.match(html, new RegExp(`id="${id}"`));
assert.match(html, /M12 2v2m0 16v2/); // restrained eight-spoke settings icon
assert.match(html, /dialog-close::before/);
assert.match(router, /training-modes\.mjs/);
assert.match(router, /training-shell\.mjs/);
assert.match(modes, /setMode\(next\)/);
assert.doesNotMatch(html, /id="training-mode"/);
console.log('training shell tabs and shared overlays are wired');
