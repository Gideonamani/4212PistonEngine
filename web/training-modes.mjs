const $ = id => document.getElementById(id);
const model = globalThis.trainingModel || {};
const tabs = [...document.querySelectorAll('[data-training-mode]')];
const panel = $('guided-mode');
const learnGalleryEl = $('learn-gallery');
const checkGalleryEl = $('check-gallery');
const viewerEl = $('guided-viewer');
const h1El = document.querySelector('h1');
const ledeEl = document.querySelector('.lede');
const originalHeading = h1El ? h1El.textContent : '';
const originalLede = ledeEl ? ledeEl.textContent : '';

const urlParams = new URLSearchParams(location.search);
let mode = urlParams.get('mode') || 'explore';
let trackId = urlParams.get('track') || null;
let lessonId = urlParams.get('lesson') || null;
let checkLessonId = urlParams.get('check') || null;

let packs = [];
let registry = { models: [] };
const lessonIndex = new Map(); // lessonId -> {lesson, pack}

let lesson, step = -1, revealed = false;
let checkLesson, checks, checkPrivacy, check = 0;

function syncUrl() {
  const p = new URLSearchParams(location.search);
  if (mode === 'explore') p.delete('mode'); else p.set('mode', mode);
  if (!lessonId && trackId) p.set('track', trackId); else p.delete('track');
  if (lessonId) p.set('lesson', lessonId); else p.delete('lesson');
  if (checkLessonId) p.set('check', checkLessonId); else p.delete('check');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function findModel(modelId) {
  return registry.models.find(item => item.id === modelId);
}

// Learn's model-pose steps get their own live-lite engine-core.mjs instance rather than
// driving Explore's shared viewer — see docs/mode-shell-viewer-separation.md. Loaded lazily
// so a lesson that never shows a model-pose step never pays for Three.js.
let engineCorePromise = null;
function loadEngineCore() {
  return engineCorePromise ||= import('./engine-core.mjs');
}
let liveViewer = null, liveViewerGeneration = 0;
function disposeLiveViewer() {
  liveViewerGeneration++;
  liveViewer?.dispose();
  liveViewer = null;
  const liveView = $('guided-live-view');
  if (liveView) { liveView.hidden = true; liveView.replaceChildren(); }
}
async function ensureLiveViewer() {
  if (liveViewer) return liveViewer;
  const generation = ++liveViewerGeneration;
  const { createEngineCore } = await loadEngineCore();
  const instance = await createEngineCore($('guided-live-view'), {
    assetUrl: model.asset_url, assetFallbackUrl: model.asset_fallback_url,
    motionProfileUrl: model.motion_profile_url, angle: 0,
  });
  if (generation !== liveViewerGeneration) { instance.dispose(); return null; } // stale: lesson/mode changed mid-mount
  liveViewer = instance;
  return liveViewer;
}

function renderProgress(current, total) {
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

function setFeedback(text) {
  const el = $('guided-feedback');
  el.textContent = text;
  el.hidden = !text;
}

function evidenceTag(note) {
  if (!note) return '';
  if (/^Documented/.test(note)) return '<span class="evidence-tag documented">Documented</span>';
  if (/^General/.test(note) || /^Reflective/.test(note)) return '<span class="evidence-tag illustrative">General / illustrative</span>';
  return '';
}

// Ported from the retired web/learn.mjs: text/image/web-embed/external-link rendering
// has no 3D dependency and stays the same regardless of which model this page loaded.
function renderGenericStepBody(current) {
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

function renderModelPoseBody(current) {
  const body = $('guided-body');
  const liveView = $('guided-live-view');
  const sameModel = current.modelId === model.id;
  if (!sameModel) {
    disposeLiveViewer();
    liveView.hidden = true;
    const target = findModel(current.modelId);
    body.innerHTML = target
      ? `<p id="guided-prompt">${current.prompt}</p><div class="model-card"><div class="model-card-text"><span class="model-card-label">3D reference model</span><span class="model-card-name">${target.label}</span></div><a class="open-btn" href="./training.html?model=${target.id}&mode=learn&track=${trackId || ''}&lesson=${lessonId}" target="_blank" rel="noopener">Open 3D view →</a></div>`
      : `<p id="guided-prompt">${current.prompt}</p><div class="placeholder-box"><span class="placeholder-label">3D reference model not yet available</span><span class="placeholder-caption">Registry id "${current.modelId}" has no asset yet.</span></div>`;
    body.innerHTML += evidenceTag(current.note) + (current.note ? `<p class="step-note">${current.note}</p>` : '');
    setFeedback('');
    $('guided-explore-link').hidden = true;
    return;
  }
  $('guided-explore-link').hidden = false;
  liveView.hidden = false;
  body.innerHTML = `<div class="predict-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>${revealed ? 'Observed' : 'Predict before you reveal'}</span></div>
    <p id="guided-prompt">${current.prompt}</p>
    ${revealed ? '' : '<textarea id="guided-scratch" class="scratch-input" placeholder="Type your prediction here… (not saved)"></textarea>'}`;
  setFeedback(revealed ? current.note : 'Make your prediction first. Reveal the observation only when you are ready to compare it.');
  const angle = revealed ? current.action.value : 0;
  const cycle = revealed && current.action.type === 'cycle-angle';
  const generation = liveViewerGeneration;
  ensureLiveViewer().then(instance => {
    if (!instance || generation !== liveViewerGeneration) return; // stale: student moved on before this mounted
    instance.setPose(angle, { cycle });
  }).catch(e => {
    liveView.innerHTML = `<p class="step-note" style="padding:16px">3D view unavailable here: ${e.message}</p>`;
    console.warn(e);
  });
}

function renderLearn() {
  const current = lesson.steps[step];
  renderProgress(step, lesson.steps.length);
  $('guided-step-label').hidden = false;
  $('guided-step-label').textContent = `Step ${step + 1}/${lesson.steps.length}`;
  $('guided-title').textContent = lesson.title;
  if (current.type === 'model-pose') renderModelPoseBody(current);
  else {
    $('guided-live-view').hidden = true;
    $('guided-body').innerHTML = renderGenericStepBody(current);
    setFeedback('');
    $('guided-explore-link').hidden = true;
  }
  $('guided-back').disabled = step <= 0;
  const next = $('guided-next');
  next.disabled = false;
  next.textContent = current.type === 'model-pose'
    ? (!revealed ? 'Reveal observation' : (step === lesson.steps.length - 1 ? 'Finish lesson' : 'Next step'))
    : (step === lesson.steps.length - 1 ? 'Finish lesson' : 'Next step');
}

function renderMultipleChoiceCheck(current, next) {
  setFeedback('Choose an answer, or reveal a hint first. If it is not correct, use the feedback and try again.');
  const answers = document.createElement('div'); answers.className = 'stack';
  const hint = document.createElement('button'); hint.type = 'button'; hint.textContent = 'Need a hint?';
  hint.onclick = () => { setFeedback(`Hint: ${current.hint}`); };
  answers.append(hint);
  current.answers.forEach((answer, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = answer;
    button.onclick = () => {
      const correct = index === current.correct;
      if (correct) {
        [...answers.children].forEach(item => item.disabled = true);
        button.classList.add('btn-primary');
        next.disabled = false;
        setFeedback(`Correct. ${current.rationale}`);
      } else {
        button.disabled = true;
        setFeedback(`Not quite. ${current.rationale} Try another answer.`);
      }
    };
    answers.append(button);
  });
  $('guided-body').append(answers);
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderOrderingCheck(current, next) {
  setFeedback('Put the items in order, then check your answer. Use the arrows to reorder.');
  let order = shuffled(current.items);
  if (order.length > 1 && order.every((item, i) => item === current.items[i])) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  const list = document.createElement('ol'); list.className = 'order-list';
  const checkBtn = document.createElement('button'); checkBtn.type = 'button'; checkBtn.className = 'btn-primary'; checkBtn.textContent = 'Check order';
  function draw() {
    list.replaceChildren();
    order.forEach((item, index) => {
      const li = document.createElement('li'); li.className = 'order-item';
      const num = document.createElement('span'); num.className = 'order-num'; num.textContent = String(index + 1);
      const text = document.createElement('span'); text.className = 'order-text'; text.textContent = item;
      const controls = document.createElement('div'); controls.className = 'order-controls';
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.disabled = index === 0;
      up.onclick = () => { [order[index - 1], order[index]] = [order[index], order[index - 1]]; draw(); };
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.disabled = index === order.length - 1;
      down.onclick = () => { [order[index + 1], order[index]] = [order[index], order[index + 1]]; draw(); };
      controls.append(up, down);
      li.append(num, text, controls);
      list.append(li);
    });
  }
  draw();
  checkBtn.onclick = () => {
    const correct = order.every((item, index) => item === current.items[index]);
    if (correct) {
      list.querySelectorAll('button').forEach(item => item.disabled = true);
      checkBtn.disabled = true;
      next.disabled = false;
      setFeedback(`Correct. ${current.rationale}`);
    } else {
      setFeedback(`Not quite. ${current.rationale} Try another order.`);
    }
  };
  $('guided-body').append(list, checkBtn);
}

function renderCheck() {
  const current = checks[check];
  $('guided-progress').hidden = true;
  $('guided-step-label').hidden = true;
  $('guided-explore-link').hidden = true;
  $('guided-title').textContent = `${checkLesson.title} · ${check + 1}/${checks.length}`;
  $('guided-body').innerHTML = `<p id="guided-prompt">${current.question}</p>`;
  $('guided-back').disabled = check <= 0;
  const next = $('guided-next');
  next.textContent = check === checks.length - 1 ? 'Finish check' : 'Next question';
  next.disabled = true;
  if (current.type === 'multiple-choice') renderMultipleChoiceCheck(current, next);
  else if (current.type === 'ordering') renderOrderingCheck(current, next);
  else {
    setFeedback('This question type is not yet supported in Check yourself.');
    next.disabled = false;
  }
}

function trackLessons(pack) {
  return pack.lessons.filter(item => item.listed !== false);
}

function renderTrackGallery() {
  learnGalleryEl.innerHTML = `<div class="gallery-head"><span class="eyebrow" style="margin:0">Learning tracks</span></div>
    <div class="track-grid">${packs.map(pack => `
      <button class="track-card" type="button" data-track="${pack.id}">
        <span class="track-title">${pack.title || pack.id}${pack.draftStatus ? '<span class="track-badge">Draft</span>' : ''}</span>
        <p class="track-desc">${pack.description || ''}</p>
        <span class="track-meta">${trackLessons(pack).length} lesson${trackLessons(pack).length === 1 ? '' : 's'}</span>
      </button>`).join('')}</div>`;
  learnGalleryEl.querySelectorAll('[data-track]').forEach(btn => {
    btn.onclick = () => { trackId = btn.dataset.track; syncUrl(); render(); };
  });
}

function renderTrackLessonList() {
  const pack = packs.find(item => item.id === trackId);
  if (!pack) { trackId = null; return renderTrackGallery(); }
  const visible = trackLessons(pack);
  learnGalleryEl.innerHTML = `<button class="back-link" type="button" id="track-back">← All tracks</button>
    <div class="gallery-head"><span class="eyebrow" style="margin:0">${pack.title || pack.id}</span></div>
    <p class="track-desc-lg">${pack.description || ''}</p>
    <ol class="lesson-list">${visible.map((item, index) => `
      <li><button class="lesson-item" type="button" data-lesson="${item.id}">
        <span class="lesson-num">LESSON ${String(index + 1).padStart(2, '0')}</span>
        <span class="lesson-title">${item.title}</span>
        <span class="lesson-meta">${item.steps.length} step${item.steps.length === 1 ? '' : 's'}${item.models.length ? ' · has a reference model' : ''}</span>
      </button></li>`).join('')}</ol>`;
  $('track-back').onclick = () => { trackId = null; syncUrl(); render(); };
  learnGalleryEl.querySelectorAll('[data-lesson]').forEach(btn => {
    btn.onclick = () => { openLesson(btn.dataset.lesson); syncUrl(); render(); };
  });
}

function renderCheckGallery() {
  const entries = [...lessonIndex.values()].filter(({ lesson: item, pack }) => (pack.checks || []).some(c => c.lessonId === item.id));
  checkGalleryEl.innerHTML = `<div class="gallery-head"><span class="eyebrow" style="margin:0">Check yourself</span></div>` +
    (entries.length
      ? `<ol class="lesson-list">${entries.map(({ lesson: item, pack }) => {
          const count = pack.checks.filter(c => c.lessonId === item.id).length;
          return `<li><button class="lesson-item" type="button" data-check="${item.id}">
            <span class="lesson-title">${item.title}</span>
            <span class="lesson-meta">${pack.title || pack.id} · ${count} question${count === 1 ? '' : 's'}</span>
          </button></li>`;
        }).join('')}</ol>`
      : `<p class="empty-state">No self-checks are available yet.</p>`);
  checkGalleryEl.querySelectorAll('[data-check]').forEach(btn => {
    btn.onclick = () => { openCheckLesson(btn.dataset.check); syncUrl(); render(); };
  });
}

function openLesson(id) {
  const entry = lessonIndex.get(id);
  if (!entry) return false;
  lesson = entry.lesson;
  lessonId = id;
  trackId = entry.pack.id;
  step = 0;
  revealed = false;
  return true;
}

function openCheckLesson(id) {
  const entry = lessonIndex.get(id);
  if (!entry) return false;
  const items = (entry.pack.checks || []).filter(c => c.lessonId === id);
  if (!items.length) return false;
  checkLesson = entry.lesson;
  checks = items;
  checkPrivacy = entry.pack.privacy;
  checkLessonId = id;
  check = 0;
  return true;
}

function showExplore() {
  panel.hidden = true;
  $('training-mode-note').textContent = 'Explore freely: rotate, inspect, section and operate the model.';
}

function render() {
  if (mode !== 'learn') disposeLiveViewer(); // Learn's live-lite viewer only exists while Learn is showing a model-pose step
  if (mode === 'explore') {
    h1El.textContent = originalHeading; ledeEl.textContent = originalLede;
    $('cycle-strip').hidden = true;
    return showExplore();
  }
  panel.hidden = false;
  if (mode === 'learn') {
    if (lessonId && lesson) {
      h1El.textContent = lesson.title; ledeEl.textContent = lesson.objective;
      $('cycle-strip').hidden = lesson.steps[step]?.type !== 'model-pose';
      learnGalleryEl.hidden = true; checkGalleryEl.hidden = true; viewerEl.hidden = false;
      $('training-mode-note').textContent = 'Guided prompts show one pose at a time; make a prediction before revealing each pose.';
      renderLearn();
    } else {
      disposeLiveViewer();
      h1El.textContent = originalHeading; ledeEl.textContent = originalLede;
      $('cycle-strip').hidden = true;
      viewerEl.hidden = true; checkGalleryEl.hidden = true; learnGalleryEl.hidden = false;
      $('training-mode-note').textContent = 'Choose a track, then a lesson, to begin.';
      if (trackId) renderTrackLessonList(); else renderTrackGallery();
    }
  } else {
    h1El.textContent = originalHeading; ledeEl.textContent = originalLede;
    $('cycle-strip').hidden = true;
    if (checkLessonId && checks) {
      learnGalleryEl.hidden = true; checkGalleryEl.hidden = true; viewerEl.hidden = false;
      $('training-mode-note').textContent = checkPrivacy;
      renderCheck();
    } else {
      viewerEl.hidden = true; learnGalleryEl.hidden = true; checkGalleryEl.hidden = false;
      $('training-mode-note').textContent = 'Choose a lesson to check your understanding of it.';
      renderCheckGallery();
    }
  }
}

function setMode(next) {
  if (tabs.find(tab => tab.dataset.trainingMode === next)?.disabled) return;
  mode = next;
  tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.trainingMode === mode)));
  document.body.dataset.trainingMode = mode;
  syncUrl();
  render();
}
tabs.forEach(tab => { tab.onclick = () => setMode(tab.dataset.trainingMode); });

$('guided-next').onclick = () => {
  if (mode === 'learn') {
    const current = lesson.steps[step];
    if (current.type === 'model-pose' && !revealed) { revealed = true; render(); return; }
    if (step < lesson.steps.length - 1) { step++; revealed = false; render(); return; }
    lessonId = null; step = -1; revealed = false; syncUrl(); render();
  } else if (check < checks.length - 1) { check++; render(); }
  else { checkLessonId = null; check = 0; syncUrl(); render(); }
};
$('guided-back').onclick = () => {
  if (mode === 'learn') { step = Math.max(0, step - 1); revealed = true; render(); }
  else { check = Math.max(0, check - 1); render(); }
};
$('guided-explore-link').onclick = () => setMode('explore');

async function loadPacks() {
  const manifest = await fetch('./lessons-manifest.json').then(response => {
    if (!response.ok) throw Error('Lessons manifest unavailable');
    return response.json();
  });
  return Promise.all(manifest.packs.map(url => fetch(url).then(response => {
    if (!response.ok) throw Error(`Lesson pack unavailable: ${url}`);
    return response.json();
  })));
}
async function loadRegistry() {
  try { return await fetch('./models.json').then(response => response.json()); }
  catch { return { models: [] }; }
}

try {
  const [loadedPacks, loadedRegistry] = await Promise.all([loadPacks(), loadRegistry()]);
  packs = loadedPacks;
  registry = loadedRegistry;
  for (const pack of packs) for (const item of trackLessons(pack)) lessonIndex.set(item.id, { lesson: item, pack });
  tabs.filter(tab => tab.dataset.trainingMode !== 'explore').forEach(tab => tab.disabled = false);
  if (lessonId && !openLesson(lessonId)) lessonId = null;
  if (checkLessonId && !openCheckLesson(checkLessonId)) checkLessonId = null;
  if (mode !== 'explore' && tabs.find(tab => tab.dataset.trainingMode === mode)?.disabled) mode = 'explore';
} catch (error) {
  tabs.filter(tab => tab.dataset.trainingMode !== 'explore').forEach(tab => tab.disabled = true);
  $('training-mode-note').textContent = 'Guided lessons are unavailable; free exploration remains available.';
  mode = 'explore';
  console.warn(error);
}
tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.trainingMode === mode)));
document.body.dataset.trainingMode = mode;
render();
