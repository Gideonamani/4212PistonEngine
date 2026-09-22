// Chrome shared by explore.html/learn.html/check.html: dialogs, the reduced-motion
// setting, and the cross-page mode nav. Each page calls initPageShell(currentMode)
// once it knows which model it's showing, so the nav links carry ?model= forward.
const $ = id => document.getElementById(id);

for (const opener of document.querySelectorAll('.dialog-open')) {
  opener.onclick = () => $(opener.dataset.dialog)?.showModal();
}
for (const closer of document.querySelectorAll('.dialog-close')) {
  closer.onclick = () => closer.closest('dialog')?.close();
}
const reduced = $('reduced-motion');
const saved = localStorage.getItem('4212-reduced-motion') === 'true';
reduced.checked = saved;
document.body.classList.toggle('reduced-motion', saved);
reduced.onchange = () => {
  localStorage.setItem('4212-reduced-motion', String(reduced.checked));
  document.body.classList.toggle('reduced-motion', reduced.checked);
};
const appearance = $('appearance');
const inspection = $('settings-inspection');
if (appearance && inspection) {
  inspection.checked = appearance.value === 'inspection';
  inspection.onchange = () => { appearance.value = inspection.checked ? 'inspection' : 'cad'; appearance.dispatchEvent(new Event('change')); };
  appearance.addEventListener('change', () => { inspection.checked = appearance.value === 'inspection'; });
}

/** @param {'explore'|'learn'|'check'} currentMode @param {string} [modelId] */
export function initPageShell(currentMode, modelId) {
  document.body.dataset.trainingMode = currentMode;
  for (const tab of document.querySelectorAll('[data-training-mode]')) {
    const isCurrent = tab.dataset.trainingMode === currentMode;
    tab.setAttribute('aria-selected', String(isCurrent));
    if (tab.tagName === 'A' && modelId) {
      const url = new URL(tab.getAttribute('href'), location.href);
      url.searchParams.set('model', modelId);
      tab.href = url.pathname + url.search;
    }
  }
}
