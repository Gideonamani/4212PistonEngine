const $ = id => document.getElementById(id);
const model = globalThis.trainingModel || {};
const tabs = [...document.querySelectorAll('[data-training-mode]')];
const panel = $('guided-mode');
let pack, lesson, step = -1, check = 0, mode = 'explore', revealed = false;

function setAngle(value, cycle = false) {
  const slider = $('motion-angle');
  if (!slider) return;
  if (cycle) {
    const cue = $('cycle-enabled');
    if (cue && !cue.checked) { cue.checked = true; cue.dispatchEvent(new Event('change')); }
  }
  slider.value = String(value);
  slider.dispatchEvent(new Event('input'));
}

function showExplore() {
  panel.hidden = true;
  $('training-mode-note').textContent = 'Explore freely: rotate, inspect, section and operate the model.';
}

function renderLearn() {
  const current = lesson.steps[step];
  $('guided-title').textContent = `${lesson.title} · Step ${step + 1}/${lesson.steps.length}`;
  $('guided-prompt').textContent = current.prompt;
  $('guided-answers').replaceChildren();
  $('guided-feedback').textContent = revealed ? current.note : 'Make your prediction first. Reveal the observation only when you are ready to compare it.';
  $('guided-back').disabled = step <= 0;
  const next = $('guided-next');
  next.disabled = false;
  next.textContent = !revealed ? 'Reveal observation' : (step === lesson.steps.length - 1 ? 'Finish lesson' : 'Next step');
  if (revealed) setAngle(current.action.value, current.action.type === 'cycle-angle');
  else setAngle(0);
}

function renderCheck() {
  const current = pack.checks[check];
  $('guided-title').textContent = `Check yourself · ${check + 1}/${pack.checks.length}`;
  $('guided-prompt').textContent = current.question;
  $('guided-feedback').textContent = 'Choose an answer, or reveal a hint first. If it is not correct, use the feedback and try again.';
  $('guided-back').disabled = check <= 0;
  const next = $('guided-next');
  next.textContent = check === pack.checks.length - 1 ? 'Finish check' : 'Next question';
  next.disabled = true;
  const answers = $('guided-answers'); answers.replaceChildren();
  const hint = document.createElement('button'); hint.type = 'button'; hint.textContent = 'Need a hint?';
  hint.onclick = () => { $('guided-feedback').textContent = `Hint: ${current.hint}`; };
  answers.append(hint);
  current.answers.forEach((answer, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = answer;
    button.onclick = () => {
      const correct = index === current.correct;
      if (correct) {
        [...answers.children].forEach(item => item.disabled = true);
        button.classList.add('btn-primary');
        next.disabled = false;
        $('guided-feedback').textContent = `Correct. ${current.rationale}`;
      } else {
        button.disabled = true;
        $('guided-feedback').textContent = `Not quite. ${current.rationale} Try another answer.`;
      }
    };
    answers.append(button);
  });
}

function render() {
  if (mode === 'explore') return showExplore();
  panel.hidden = false;
  $('training-mode-note').textContent = mode === 'learn' ? 'Guided prompts use the same model controls; make a prediction before revealing each pose.' : pack.privacy;
  if (mode === 'learn') renderLearn(); else renderCheck();
}

function setMode(next) {
  if (tabs.find(tab => tab.dataset.trainingMode === next)?.disabled) return;
  mode = next; step = next === 'learn' ? 0 : -1; check = 0; revealed = false;
  tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.trainingMode === mode)));
  document.body.dataset.trainingMode = mode;
  render();
}
tabs.forEach(tab => { tab.onclick = () => setMode(tab.dataset.trainingMode); });
$('guided-next').onclick = () => {
  if (mode === 'learn') {
    if (!revealed) { revealed = true; render(); }
    else if (step < lesson.steps.length - 1) { step++; revealed = false; render(); }
    else setMode('explore');
  }
  else if (check < pack.checks.length - 1) { check++; render(); } else setMode('explore');
};
$('guided-back').onclick = () => { if (mode === 'learn') { step = Math.max(0, step - 1); revealed = true; } else check = Math.max(0, check - 1); render(); };

if (model.lesson_url) {
  try {
    pack = await fetch(model.lesson_url).then(response => { if (!response.ok) throw Error('Lesson pack unavailable'); return response.json(); });
    lesson = pack.lessons[0];
    tabs.filter(tab => tab.dataset.trainingMode !== 'explore').forEach(tab => tab.disabled = false);
  } catch (error) {
    tabs.filter(tab => tab.dataset.trainingMode !== 'explore').forEach(tab => tab.disabled = true);
    $('training-mode-note').textContent = 'Guided lessons are unavailable; free exploration remains available.';
    console.warn(error);
  }
} else tabs.filter(tab => tab.dataset.trainingMode !== 'explore').forEach(tab => tab.disabled = true);
showExplore();
