import { initPageShell, initRailCollapse, initExploreTools } from './page-shell.mjs?v=20260928-full-height-viewer-1';

const params = new URLSearchParams(location.search);
const requested = params.get('model') || 'cylinder';
const registry = await fetch('./models.json?v=20260923-drive-models-1').then(response => {
  if (!response.ok) throw Error('Training model registry unavailable');
  return response.json();
});
const model = registry.models.find(item => item.id === requested);
if (!model) throw Error(`Unknown training model: ${requested}`);
if (model.adapter === 'reference') {
  location.replace(`./?model=${encodeURIComponent(model.id)}#/explore`);
  await new Promise(() => {});
}
document.title = `4212 Piston Engine · ${model.label}`;
document.querySelector('.kicker').textContent = model.kicker;
document.querySelector('h1').textContent = model.title;
document.querySelector('.lede').textContent = model.description;
const gallery = document.getElementById('model-gallery');
if (gallery) gallery.innerHTML = registry.models.filter(item => item.adapter !== 'reference').map(item => `<a class="model-pick" href="./explore.html?model=${item.id}" aria-current="${item.id === model.id}">${item.label}</a>`).join('');
document.body.dataset.model = model.id;
globalThis.trainingModel = model;
initPageShell('explore', model.id);
initRailCollapse(document.getElementById('explorer'), document.getElementById('toggle-controls'));
initExploreTools();
if (model.adapter === 'cylinder') await import('./viewer.js?v=20260928-full-height-viewer-1');
else await import('./engine-training-adapter.mjs?v=20260928-full-height-viewer-1');
