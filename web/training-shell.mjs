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
