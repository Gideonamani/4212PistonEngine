// Shared between learn-modes.mjs and check-modes.mjs: lesson-pack/model-registry loading,
// the generic text/image/web-embed/external-link step renderer, and the live-lite
// model-pose viewer (see docs/mode-shell-viewer-separation.md). Neither page pulls in
// Explore's interactive viewer or its Three.js dependency chain unless a model-pose step
// is actually rendered, and even then only through engine-core.mjs.
const $ = id => document.getElementById(id);

export async function loadPacks() {
  const manifest = await fetch('./lessons-manifest.json').then(response => {
    if (!response.ok) throw Error('Lessons manifest unavailable');
    return response.json();
  });
  return Promise.all(manifest.packs.map(url => fetch(url).then(response => {
    if (!response.ok) throw Error(`Lesson pack unavailable: ${url}`);
    return response.json();
  })));
}

export async function loadRegistry() {
  try { return await fetch('./models.json?v=20260923-drive-models-1').then(response => response.json()); }
  catch { return { models: [] }; }
}

export function evidenceTag(note) {
  if (!note) return '';
  if (/^Documented/.test(note)) return '<span class="evidence-tag documented">Documented</span>';
  if (/^General/.test(note) || /^Reflective/.test(note)) return '<span class="evidence-tag illustrative">General / illustrative</span>';
  return '';
}

export function setFeedback(text) {
  const el = $('guided-feedback');
  el.textContent = text;
  el.hidden = !text;
}

export function renderProgress(current, total) {
  const el = $('guided-progress');
  el.hidden = false;
  el.replaceChildren();
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    dot.className = 'step-dot ' + (i < current ? 'done' : i === current ? 'current' : 'upcoming');
    if (i < current) dot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    else if (i === current) dot.innerHTML = '<span class="dot-center"></span>';
    el.append(dot);
    if (i < total - 1) {
      const line = document.createElement('span');
      line.className = 'step-connector' + (i < current ? ' done' : '');
      el.append(line);
    }
  }
}

// text/image/web-embed/external-link rendering has no 3D dependency and is identical
// regardless of which model (if any) a lesson's other steps reference.
export function renderGenericStepBody(current) {
  if (current.type === 'text') {
    return `<p id="guided-prompt">${current.prompt}</p>${evidenceTag(current.note)}${current.note ? `<p class="step-note">${current.note}</p>` : ''}`;
  }
  if (current.type === 'image') {
    const isPlaceholder = (current.url || '').startsWith('PLACEHOLDER:');
    return `<p id="guided-prompt">${current.prompt}</p>` +
      (isPlaceholder
        ? `<div class="placeholder-box"><span class="placeholder-label">Image not yet sourced</span><span class="placeholder-caption">${current.url.replace('PLACEHOLDER:', '')}</span></div>`
        : `<img src="${current.url}" alt="${current.prompt}" style="width:100%;border-radius:8px;margin-top:12px">`) +
      (current.note ? `<p class="step-note">${current.note}</p>` : '');
  }
  if (current.type === 'web-embed' || current.type === 'external-link') {
    return `<p id="guided-prompt">${current.prompt}</p>${current.url ? `<p class="step-note"><a href="${current.url}" target="_blank" rel="noopener">${current.url} →</a></p>` : ''}${current.note ? `<p class="step-note">${current.note}</p>` : ''}`;
  }
  return `<p id="guided-prompt">${current.prompt}</p>`;
}

// Learn's model-pose steps get their own live-lite engine-core.mjs instance rather than
// sharing Explore's interactive 3D viewer — see docs/mode-shell-viewer-separation.md. Loaded lazily so a
// lesson that never shows a model-pose step never pays for Three.js. A step's modelId is
// resolved independently of whatever page context it's shown in, so it always mounts the
// right model regardless of which track/pack it came from.
let engineCorePromise = null;
function loadEngineCore() {
  return engineCorePromise ||= import('./engine-core.mjs?v=20260923-drive-models-1');
}
let liveViewer = null, liveViewerModelId = null, liveViewerGeneration = 0;
function disposeInstance() {
  liveViewerGeneration++;
  liveViewer?.dispose();
  liveViewer = null;
  liveViewerModelId = null;
}
// Leaving Learn's model-pose steps entirely (mode/lesson change): drop the instance AND
// hide/clear its container. ensureLiveViewer below must not call this on every mount -
// it would immediately undo the `hidden = false` renderModelPoseBody just set.
export function disposeLiveViewer() {
  disposeInstance();
  const liveView = $('guided-live-view');
  if (liveView) { liveView.hidden = true; liveView.replaceChildren(); }
}
async function ensureLiveViewer(targetModel) {
  if (liveViewer && liveViewerModelId === targetModel.id) return liveViewer;
  disposeInstance();
  liveViewerModelId = targetModel.id;
  const generation = ++liveViewerGeneration;
  const { createEngineCore } = await loadEngineCore();
  const { modelSources } = await import('./model-source.mjs');
  const sources = await modelSources([
    { driveId: targetModel.asset_drive_id, localUrl: targetModel.asset_url },
    { driveId: targetModel.asset_fallback_drive_id, localUrl: targetModel.asset_fallback_url },
  ]);
  const instance = await createEngineCore($('guided-live-view'), {
    sources,
    motionProfileUrl: targetModel.motion_profile_url, angle: 0,
  });
  if (generation !== liveViewerGeneration) { instance.dispose(); return null; } // stale: step/lesson changed mid-mount
  liveViewer = instance;
  return liveViewer;
}

/**
 * @param {object} current the model-pose step
 * @param {{revealed:boolean, findModel:(id:string)=>object|undefined}} ctx
 */
export function renderModelPoseBody(current, { revealed, findModel }) {
  const body = $('guided-body');
  const liveView = $('guided-live-view');
  const target = findModel(current.modelId);
  if (!target || !(target.asset_url || target.asset_drive_id)) {
    disposeLiveViewer();
    body.innerHTML = `<p id="guided-prompt">${current.prompt}</p><div class="placeholder-box"><span class="placeholder-label">3D reference model not yet available</span><span class="placeholder-caption">Registry id "${current.modelId}" has no asset yet.</span></div>`;
    body.innerHTML += evidenceTag(current.note) + (current.note ? `<p class="step-note">${current.note}</p>` : '');
    setFeedback('');
    $('guided-explore-link').hidden = true;
    return;
  }
  const angle = revealed ? current.action.value : 0;
  const cycle = revealed && current.action.type === 'cycle-angle';
  $('guided-explore-link').hidden = false;
  $('guided-explore-link').onclick = () => { location.href = `./explore.html?model=${target.id}&angle=${angle}${cycle ? '&cycle=1' : ''}`; };
  liveView.hidden = false;
  body.innerHTML = `<div class="predict-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>${revealed ? 'Observed' : 'Predict before you reveal'}</span></div>
    <p id="guided-prompt">${current.prompt}</p>
    ${revealed ? '' : '<textarea id="guided-scratch" class="scratch-input" placeholder="Type your prediction here… (not saved)"></textarea>'}`;
  setFeedback(revealed ? current.note : 'Make your prediction first. Reveal the observation only when you are ready to compare it.');
  const generation = liveViewerGeneration;
  ensureLiveViewer(target).then(instance => {
    if (!instance || generation !== liveViewerGeneration) return; // stale: student moved on before this mounted
    instance.setPose(angle, { cycle });
  }).catch(e => {
    liveView.innerHTML = `<p class="step-note" style="padding:16px">3D view unavailable here: ${e.message}</p>`;
    console.warn(e);
  });
}
