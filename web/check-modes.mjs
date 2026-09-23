import { loadPacks, loadRegistry, setFeedback } from './guided-shared.mjs';
import { initPageShell, initRailCollapse } from './page-shell.mjs';

const $ = id => document.getElementById(id);
const checkGalleryEl = $('check-gallery');
const modeSelectEl = $('mode-select');
const viewerEl = $('guided-viewer');
const resultsEl = $('check-results');
const mainEl = $('check-main');

const urlParams = new URLSearchParams(location.search);
let checkLessonId = urlParams.get('check') || null;
let mode = urlParams.get('mode') || null; // 'training' | 'exam' | null (mode not yet chosen)

let packs = [];
const lessonIndex = new Map(); // lessonId -> {lesson, pack}

let checkLesson, checks, checkPrivacy, check = 0;
let answers = []; // per-question: {answered, correct?, value?, order?} - shape depends on question type
let examEndsAt = null, timerHandle = null;

function syncUrl() {
  const p = new URLSearchParams(location.search);
  if (checkLessonId) p.set('check', checkLessonId); else p.delete('check');
  if (mode) p.set('mode', mode); else p.delete('mode');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function trackLessons(pack) {
  return pack.lessons.filter(item => item.listed !== false);
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- Training: locks immediately on first answer, no retry - per
// docs/lesson-and-assessment-architecture.md's Training/Exam table ("once an
// option is selected, it locks immediately").

function renderTrainingMultipleChoice(current, next) {
  const state = answers[check];
  const wrap = document.createElement('div'); wrap.className = 'stack';
  if (!state?.answered) {
    const hint = document.createElement('button'); hint.type = 'button'; hint.textContent = 'Need a hint?';
    hint.onclick = () => setFeedback(`Hint: ${current.hint}`);
    wrap.append(hint);
    setFeedback('Choose an answer, or reveal a hint first.');
  }
  current.answers.forEach((answer, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = answer;
    button.disabled = !!state?.answered;
    if (state?.answered) {
      if (index === current.correct) button.classList.add('btn-primary');
      else if (index === state.value) button.classList.add('btn-incorrect');
    }
    button.onclick = () => { answers[check] = { answered: true, correct: index === current.correct, value: index }; renderCheck(); };
    wrap.append(button);
  });
  $('guided-body').append(wrap);
  if (state?.answered) {
    setFeedback(state.correct ? `Correct. ${current.rationale}` : `Not quite - the correct answer is highlighted. ${current.rationale}`);
  }
  next.disabled = !state?.answered;
}

function renderTrainingOrdering(current, next) {
  const state = answers[check];
  if (state?.answered) {
    setFeedback(state.correct ? `Correct. ${current.rationale}` : `Not quite - here is the correct order. ${current.rationale}`);
    const list = document.createElement('ol'); list.className = 'order-list';
    (state.correct ? state.order : current.items).forEach((item, index) => {
      const li = document.createElement('li'); li.className = 'order-item';
      li.innerHTML = `<span class="order-num">${index + 1}</span><span class="order-text">${item}</span>`;
      list.append(li);
    });
    $('guided-body').append(list);
    next.disabled = false;
    return;
  }
  setFeedback('Put the items in order, then check your answer. Use the arrows to reorder.');
  let order = shuffled(current.items);
  if (order.length > 1 && order.every((item, i) => item === current.items[i])) [order[0], order[1]] = [order[1], order[0]];
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
    answers[check] = { answered: true, correct, order: [...order] };
    renderCheck();
  };
  $('guided-body').append(list, checkBtn);
  next.disabled = true;
}

// --- Exam: free navigation, answers changeable before submit, no feedback
// shown until the whole set is submitted (docs, same table).

function renderExamMultipleChoice(current, next) {
  const state = answers[check] || {};
  const wrap = document.createElement('div'); wrap.className = 'stack';
  current.answers.forEach((answer, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = answer;
    if (state.value === index) button.classList.add('btn-primary');
    button.onclick = () => { answers[check] = { answered: true, value: index }; renderCheck(); };
    wrap.append(button);
  });
  $('guided-body').append(wrap);
  setFeedback('');
  next.disabled = false;
}

function renderExamOrdering(current, next) {
  const state = answers[check] || {};
  let order = state.order || shuffled(current.items);
  const list = document.createElement('ol'); list.className = 'order-list';
  function draw() {
    list.replaceChildren();
    order.forEach((item, index) => {
      const li = document.createElement('li'); li.className = 'order-item';
      const num = document.createElement('span'); num.className = 'order-num'; num.textContent = String(index + 1);
      const text = document.createElement('span'); text.className = 'order-text'; text.textContent = item;
      const controls = document.createElement('div'); controls.className = 'order-controls';
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.disabled = index === 0;
      up.onclick = () => { [order[index - 1], order[index]] = [order[index], order[index - 1]]; answers[check] = { answered: true, order: [...order] }; draw(); };
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.disabled = index === order.length - 1;
      down.onclick = () => { [order[index + 1], order[index]] = [order[index], order[index + 1]]; answers[check] = { answered: true, order: [...order] }; draw(); };
      controls.append(up, down);
      li.append(num, text, controls);
      list.append(li);
    });
  }
  draw();
  $('guided-body').append(list);
  setFeedback('');
  next.disabled = false;
}

function renderQuestionBody(current, next) {
  if (mode === 'training') {
    if (current.type === 'multiple-choice') return renderTrainingMultipleChoice(current, next);
    if (current.type === 'ordering') return renderTrainingOrdering(current, next);
  } else {
    if (current.type === 'multiple-choice') return renderExamMultipleChoice(current, next);
    if (current.type === 'ordering') return renderExamOrdering(current, next);
  }
  setFeedback('This question type is not yet supported in Check yourself.');
  next.disabled = false;
}

function renderCheck() {
  const current = checks[check];
  $('guided-step-label').hidden = false;
  $('guided-step-label').textContent = `Question ${check + 1} of ${checks.length}`;
  $('guided-title').textContent = checkLesson.title;
  $('guided-body').innerHTML = `<p id="guided-prompt">${current.question}</p>`;
  $('guided-back').disabled = check <= 0;
  const next = $('guided-next');
  next.textContent = check === checks.length - 1 ? (mode === 'exam' ? 'Submit exam' : 'Finish check') : 'Next question';
  renderQuestionBody(current, next);
  updateNav();
}

// Check's rail is numbers-only, never the question text (unlike Learn's stepper) -
// so the navigator itself can never give an answer away. Training's navigation stays
// linear (per the docs table) so its dots are informational only, not clickable;
// Exam's free navigation makes them real buttons.
function updateNav() {
  const nav = $('check-nav');
  nav.replaceChildren();
  checks.forEach((_, index) => {
    const li = document.createElement('li');
    const state = index === check ? 'current' : answers[index]?.answered ? 'answered' : 'unanswered';
    const el = document.createElement(mode === 'exam' ? 'button' : 'span');
    if (mode === 'exam') el.type = 'button';
    el.className = `nav-dot ${state}`;
    el.textContent = String(index + 1);
    if (mode === 'exam') el.onclick = () => { check = index; renderCheck(); };
    li.append(el);
    nav.append(li);
  });
}

function trainingMultipleChoiceCorrect(item, state) { return state?.answered && state.value === item.correct; }
function orderingCorrect(item, state) { return state?.answered && !!state.order && item.items.every((v, i) => state.order[i] === v); }

function isAnswerCorrect(item, state) {
  if (item.type === 'multiple-choice') return trainingMultipleChoiceCorrect(item, state);
  if (item.type === 'ordering') return orderingCorrect(item, state);
  return false;
}

function submitExam() {
  stopExamTimer();
  const score = checks.reduce((total, item, index) => total + (isAnswerCorrect(item, answers[index]) ? 1 : 0), 0);
  $('results-score').textContent = `${score} of ${checks.length} correct`;
  $('results-list').innerHTML = checks.map((item, index) => {
    const state = answers[index];
    const status = !state?.answered ? 'Not answered' : isAnswerCorrect(item, state) ? 'Correct' : 'Incorrect';
    return `<li class="lesson-item"><span class="lesson-num">Q${index + 1}</span><span class="lesson-title">${item.question}</span><span class="lesson-meta">${status}</span></li>`;
  }).join('');
  checkGalleryEl.hidden = true; modeSelectEl.hidden = true; viewerEl.hidden = true;
  mainEl.classList.remove('with-rail');
  $('check-rail').hidden = true; $('toggle-controls').hidden = true;
  resultsEl.hidden = false;
  $('training-mode-note').textContent = 'Exam submitted.';
}

function tickTimer() {
  const remaining = Math.max(0, Math.round((examEndsAt - Date.now()) / 1000));
  const m = Math.floor(remaining / 60), s = remaining % 60;
  $('rail-timer').textContent = `Time left: ${m}:${String(s).padStart(2, '0')}`;
  if (remaining <= 0) submitExam();
}

function startExamTimerIfNeeded() {
  $('rail-timer').hidden = false; $('submit-exam').hidden = false; $('end-session').hidden = true;
  if (examEndsAt) return;
  const seconds = Math.max(120, checks.length * 90); // ~1.5 min/question, floor of 2 minutes
  examEndsAt = Date.now() + seconds * 1000;
  tickTimer();
  timerHandle = setInterval(tickTimer, 1000);
}

function stopExamTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  examEndsAt = null;
  $('rail-timer').hidden = true;
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

function openCheckLesson(id) {
  const entry = lessonIndex.get(id);
  if (!entry) return false;
  const items = (entry.pack.checks || []).filter(c => c.lessonId === id);
  if (!items.length) return false;
  checkLesson = entry.lesson;
  checks = items;
  checkPrivacy = entry.pack.privacy;
  checkLessonId = id;
  check = 0; mode = null; answers = new Array(items.length);
  return true;
}

function exitToGallery() {
  stopExamTimer();
  checkLessonId = null; mode = null; answers = [];
  syncUrl(); render();
}

function render() {
  const rail = $('check-rail'), toggle = $('toggle-controls'), breadcrumb = $('guided-breadcrumb');
  if (checkLessonId && checks && mode) {
    checkGalleryEl.hidden = true; modeSelectEl.hidden = true; resultsEl.hidden = true; viewerEl.hidden = false;
    mainEl.classList.add('with-rail');
    rail.hidden = false; toggle.hidden = false;
    breadcrumb.hidden = false; breadcrumb.textContent = '← Choose a lesson'; breadcrumb.onclick = exitToGallery;
    $('training-mode-note').textContent = checkPrivacy;
    if (mode === 'exam') startExamTimerIfNeeded(); else { $('rail-timer').hidden = true; $('submit-exam').hidden = true; $('end-session').hidden = false; }
    renderCheck();
  } else if (checkLessonId && checks) {
    stopExamTimer();
    checkGalleryEl.hidden = true; viewerEl.hidden = true; resultsEl.hidden = true; modeSelectEl.hidden = false;
    mainEl.classList.remove('with-rail'); rail.hidden = true; toggle.hidden = true; breadcrumb.hidden = true;
    $('mode-select-title').textContent = checkLesson.title;
    $('training-mode-note').textContent = 'Choose how you want to practise.';
  } else {
    stopExamTimer();
    checkGalleryEl.hidden = false; viewerEl.hidden = true; resultsEl.hidden = true; modeSelectEl.hidden = true;
    mainEl.classList.remove('with-rail'); rail.hidden = true; toggle.hidden = true; breadcrumb.hidden = true;
    $('training-mode-note').textContent = 'Choose a lesson to check your understanding of it.';
    renderCheckGallery();
  }
}

$('mode-back').onclick = () => { checkLessonId = null; syncUrl(); render(); };
$('start-training').onclick = () => { mode = 'training'; check = 0; syncUrl(); render(); };
$('start-exam').onclick = () => { mode = 'exam'; check = 0; syncUrl(); render(); };
$('end-session').onclick = exitToGallery;
$('submit-exam').onclick = submitExam;
$('results-done').onclick = exitToGallery;

$('guided-next').onclick = () => {
  if (check < checks.length - 1) { check++; render(); return; }
  if (mode === 'exam') { submitExam(); return; }
  exitToGallery();
};
$('guided-back').onclick = () => { check = Math.max(0, check - 1); render(); };

try {
  const [loadedPacks] = await Promise.all([loadPacks(), loadRegistry()]);
  packs = loadedPacks;
  for (const pack of packs) for (const item of trackLessons(pack)) lessonIndex.set(item.id, { lesson: item, pack });
  if (checkLessonId && !openCheckLesson(checkLessonId)) checkLessonId = null;
  // openCheckLesson resets mode for a fresh gallery pick; restore it here so a
  // direct/shared URL (?check=...&mode=...) reopens mid-exam-or-training instead of
  // bouncing back to the mode-select screen.
  else if (['training', 'exam'].includes(urlParams.get('mode'))) mode = urlParams.get('mode');
} catch (error) {
  $('training-mode-note').textContent = 'Self-checks are unavailable; try reloading this page.';
  console.warn(error);
}
initPageShell('check');
initRailCollapse(mainEl, $('toggle-controls'));
render();
