import { initPageShell, initRailCollapse } from './page-shell.mjs';

const params = new URLSearchParams(location.search);
const requested = params.get('model') || 'cylinder';
const registry = await fetch('./models.json?v=20260923-drive-models-1').then(response => {
  if (!response.ok) throw Error('Training model registry unavailable');
  return response.json();
});
const model = registry.models.find(item => item.id === requested);
if (!model) throw Error(`Unknown training model: ${requested}`);
document.title = `4212 Piston Engine · ${model.label}`;
document.querySelector('.kicker').textContent = model.kicker;
document.querySelector('h1').textContent = model.title;
document.querySelector('.lede').textContent = model.description;
const gallery = document.getElementById('model-gallery');
if (gallery) gallery.innerHTML = registry.models.map(item => `<a class="model-pick" href="./explore.html?model=${item.id}" aria-current="${item.id === model.id}">${item.label}</a>`).join('');
document.body.dataset.model = model.id;
globalThis.trainingModel = model;
if (model.adapter === 'cylinder') await import('./viewer.js?v=20260923-drive-models-1');
else await import('./engine-training-adapter.mjs?v=20260923-drive-models-1');
initPageShell('explore', model.id);
initRailCollapse(document.getElementById('explorer'), document.getElementById('toggle-controls'));
