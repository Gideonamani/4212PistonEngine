import { loadPacks, loadRegistry, setFeedback, renderProgress, renderGenericStepBody, renderModelPoseBody, disposeLiveViewer } from './guided-shared.mjs';
import { initPageShell } from './page-shell.mjs';

const $ = id => document.getElementById(id);
const learnGalleryEl = $('learn-gallery');
const viewerEl = $('guided-viewer');
const h1El = document.querySelector('h1');
const ledeEl = document.querySelector('.lede');
const originalHeading = h1El.textContent;
const originalLede = ledeEl.textContent;

const urlParams = new URLSearchParams(location.search);
let trackId = urlParams.get('track') || null;
let lessonId = urlParams.get('lesson') || null;

let packs = [];
let registry = { models: [] };
const lessonIndex = new Map(); // lessonId -> {lesson, pack}

let lesson, step = -1, revealed = false;

function syncUrl() {
  const p = new URLSearchParams(location.search);
  if (!lessonId && trackId) p.set('track', trackId); else p.delete('track');
  if (lessonId) p.set('lesson', lessonId); else p.delete('lesson');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function findModel(modelId) {
  return registry.models.find(item => item.id === modelId);
}

function renderLearn() {
  const current = lesson.steps[step];
  renderProgress(step, lesson.steps.length);
  $('guided-step-label').hidden = false;
  $('guided-step-label').textContent = `Step ${step + 1}/${lesson.steps.length}`;
  $('guided-title').textContent = lesson.title;
  if (current.type === 'model-pose') renderModelPoseBody(current, { revealed, findModel });
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

function render() {
  if (lessonId && lesson) {
    h1El.textContent = lesson.title; ledeEl.textContent = lesson.objective;
    learnGalleryEl.hidden = true; viewerEl.hidden = false;
    $('training-mode-note').textContent = 'Guided prompts show one pose at a time; make a prediction before revealing each pose.';
    renderLearn();
  } else {
    disposeLiveViewer();
    h1El.textContent = originalHeading; ledeEl.textContent = originalLede;
    viewerEl.hidden = true; learnGalleryEl.hidden = false;
    $('training-mode-note').textContent = 'Choose a track, then a lesson, to begin.';
    if (trackId) renderTrackLessonList(); else renderTrackGallery();
  }
}

$('guided-next').onclick = () => {
  const current = lesson.steps[step];
  if (current.type === 'model-pose' && !revealed) { revealed = true; render(); return; }
  if (step < lesson.steps.length - 1) { step++; revealed = false; render(); return; }
  lessonId = null; step = -1; revealed = false; syncUrl(); render();
};
$('guided-back').onclick = () => { step = Math.max(0, step - 1); revealed = true; render(); };

try {
  const [loadedPacks, loadedRegistry] = await Promise.all([loadPacks(), loadRegistry()]);
  packs = loadedPacks;
  registry = loadedRegistry;
  for (const pack of packs) for (const item of trackLessons(pack)) lessonIndex.set(item.id, { lesson: item, pack });
  if (lessonId && !openLesson(lessonId)) lessonId = null;
} catch (error) {
  $('training-mode-note').textContent = 'Guided lessons are unavailable; try reloading this page.';
  console.warn(error);
}
initPageShell('learn');
render();
