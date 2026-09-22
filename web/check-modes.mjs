import { loadPacks, loadRegistry, setFeedback } from './guided-shared.mjs';
import { initPageShell } from './page-shell.mjs';

const $ = id => document.getElementById(id);
const checkGalleryEl = $('check-gallery');
const viewerEl = $('guided-viewer');

const urlParams = new URLSearchParams(location.search);
let checkLessonId = urlParams.get('check') || null;

let packs = [];
const lessonIndex = new Map(); // lessonId -> {lesson, pack}

let checkLesson, checks, checkPrivacy, check = 0;

function syncUrl() {
  const p = new URLSearchParams(location.search);
  if (checkLessonId) p.set('check', checkLessonId); else p.delete('check');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function trackLessons(pack) {
  return pack.lessons.filter(item => item.listed !== false);
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
  check = 0;
  return true;
}

function render() {
  if (checkLessonId && checks) {
    checkGalleryEl.hidden = true; viewerEl.hidden = false;
    $('training-mode-note').textContent = checkPrivacy;
    renderCheck();
  } else {
    checkGalleryEl.hidden = false; viewerEl.hidden = true;
    $('training-mode-note').textContent = 'Choose a lesson to check your understanding of it.';
    renderCheckGallery();
  }
}

$('guided-next').onclick = () => {
  if (check < checks.length - 1) { check++; render(); }
  else { checkLessonId = null; check = 0; syncUrl(); render(); }
};
$('guided-back').onclick = () => { check = Math.max(0, check - 1); render(); };

try {
  const [loadedPacks] = await Promise.all([loadPacks(), loadRegistry()]);
  packs = loadedPacks;
  for (const pack of packs) for (const item of trackLessons(pack)) lessonIndex.set(item.id, { lesson: item, pack });
  if (checkLessonId && !openCheckLesson(checkLessonId)) checkLessonId = null;
} catch (error) {
  $('training-mode-note').textContent = 'Self-checks are unavailable; try reloading this page.';
  console.warn(error);
}
initPageShell('check');
render();
