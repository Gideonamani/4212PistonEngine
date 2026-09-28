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

// One collapse control shared by every page's right rail (Explore's inspection panel,
// Learn's step rail, Check's question navigator) - same small icon-only button anchored
// to the rail's divider, same vertical position whether the rail is open or collapsed.
// Persisted per page so opening Explore's mobile sheet does not change the separate
// navigation state used by Learn or Check.
/** @param {HTMLElement} mainEl the <main class="with-rail"> element whose aside this button controls @param {HTMLButtonElement} toggle */
export function initRailCollapse(mainEl, toggle) {
  const rail = $(toggle.getAttribute('aria-controls'));
  const storageKey = `4212-${mainEl.id || 'page'}-rail-collapsed`;
  const stored = localStorage.getItem(storageKey);
  const mobileDefault = mainEl.dataset.mobileDefaultCollapsed === 'true' && matchMedia('(max-width: 800px)').matches;
  const collapsed = stored === null ? mobileDefault : stored === 'true';

  function sync(next) {
    mainEl.classList.toggle('rail-collapsed', next);
    toggle.setAttribute('aria-expanded', String(!next));
    toggle.setAttribute('aria-label', next ? 'Show side panel' : 'Hide side panel');
    toggle.title = next ? 'Show controls' : 'Hide controls';
    if (rail) {
      rail.inert = next;
      rail.setAttribute('aria-hidden', String(next));
    }
    mainEl.dispatchEvent(new CustomEvent('rail-visibility-change', {detail: {collapsed: next}}));
  }
  sync(collapsed);
  toggle.onclick = () => {
    const next = mainEl.classList.toggle('rail-collapsed');
    sync(next);
    localStorage.setItem(storageKey, String(next));
    if (!next) rail?.querySelector('[role="tab"],button,input,select')?.focus({preventScroll: true});
  };
}

// Explore's mobile sheet uses the existing form controls as its single source of
// truth. Compact HUD controls proxy those inputs instead of creating a second
// motion or section state.
export function initExploreTools() {
  const explorer = $('explorer');
  const controlsToggle = $('toggle-controls');
  const closeControls = $('close-controls');
  if (controlsToggle && closeControls) closeControls.onclick = () => controlsToggle.click();

  const tabs = [...document.querySelectorAll('.tool-tab')];
  const panes = [...document.querySelectorAll('.tool-pane')];
  const activate = tool => {
    for (const tab of tabs) {
      const active = tab.dataset.tool === tool;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const pane of panes) pane.hidden = pane.id !== `tool-${tool}`;
  };
  tabs.forEach((tab, index) => {
    tab.onclick = () => activate(tab.dataset.tool);
    tab.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const target = tabs[(index + direction + tabs.length) % tabs.length];
      activate(target.dataset.tool);
      target.focus();
    };
  });
  activate('components');

  const sourceAngle = $('motion-angle');
  const compactAngle = $('motion-angle-compact');
  const sourceValue = $('motion-value');
  const compactValue = $('motion-value-compact');
  const sourcePlay = $('motion-play');
  const compactPlay = $('motion-play-compact');
  const compactMotion = $('compact-motion');
  const playerPreference = $('player-on-viewer');
  const playerStorageKey = '4212-explore-show-player';
  const savedPlayerPreference = localStorage.getItem(playerStorageKey);
  let showPlayerOnViewer = savedPlayerPreference === null ? true : savedPlayerPreference === 'true';
  const syncPlayerVisibility = () => {
    const controlsAreClosed = explorer?.classList.contains('rail-collapsed');
    const visible = Boolean(showPlayerOnViewer && controlsAreClosed);
    explorer?.classList.toggle('show-floating-player', showPlayerOnViewer);
    if (compactMotion) {
      compactMotion.hidden = !visible;
      compactMotion.setAttribute('aria-hidden', String(!visible));
    }
    if (playerPreference) playerPreference.checked = showPlayerOnViewer;
  };
  if (playerPreference) playerPreference.onchange = () => {
    showPlayerOnViewer = playerPreference.checked;
    localStorage.setItem(playerStorageKey, String(showPlayerOnViewer));
    syncPlayerVisibility();
  };
  explorer?.addEventListener('rail-visibility-change', syncPlayerVisibility);
  syncPlayerVisibility();
  if (sourceAngle && compactAngle) {
    compactAngle.oninput = () => {
      sourceAngle.value = compactAngle.value;
      sourceAngle.dispatchEvent(new Event('input', {bubbles: true}));
    };
    const syncMotion = () => {
      compactAngle.value = sourceAngle.value;
      compactAngle.disabled = sourceAngle.disabled;
      compactValue.textContent = sourceValue.textContent;
      const playing = sourcePlay.getAttribute('aria-pressed') === 'true';
      compactPlay.setAttribute('aria-pressed', String(playing));
      compactPlay.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    };
    compactPlay.onclick = () => sourcePlay.click();
    new MutationObserver(syncMotion).observe(sourceValue, {childList: true, characterData: true, subtree: true});
    new MutationObserver(syncMotion).observe(sourcePlay, {attributes: true, attributeFilter: ['aria-pressed', 'disabled']});
    new MutationObserver(syncMotion).observe(sourceAngle, {attributes: true, attributeFilter: ['disabled', 'value']});
    sourceAngle.addEventListener('input', syncMotion);
    syncMotion();
  }

  const isolate = $('isolate');
  const quickIsolate = $('quick-isolate');
  if (isolate && quickIsolate) {
    const syncIsolate = () => { quickIsolate.disabled = isolate.disabled; };
    quickIsolate.onclick = () => isolate.click();
    new MutationObserver(syncIsolate).observe(isolate, {attributes: true, attributeFilter: ['disabled']});
    syncIsolate();
  }

  const section = $('section-enabled');
  const quickSection = $('quick-section');
  if (section && quickSection) {
    const syncSection = () => {
      quickSection.disabled = section.disabled;
      quickSection.setAttribute('aria-pressed', String(section.checked));
    };
    quickSection.onclick = () => {
      if (section.disabled) return;
      section.checked = !section.checked;
      section.dispatchEvent(new Event('change', {bubbles: true}));
      syncSection();
    };
    section.addEventListener('change', syncSection);
    new MutationObserver(syncSection).observe(section, {attributes: true, attributeFilter: ['disabled', 'checked']});
    syncSection();
  }
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
