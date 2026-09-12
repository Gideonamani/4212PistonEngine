const $ = id => document.getElementById(id);
const model = globalThis.trainingModel || {};
const mode = $('training-mode');
const panel = $('guided-mode');
let pack, lesson, step = -1, check = 0;

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
  $('guided-title').textContent = lesson.title;
  $('guided-prompt').textContent = current.prompt;
  $('guided-answers').replaceChildren();
  $('guided-feedback').textContent = current.note;
  $('guided-back').disabled = step <= 0;
  $('guided-next').textContent = step === lesson.steps.length - 1 ? 'Finish lesson' : 'Next step';
  setAngle(current.action.value, current.action.type === 'cycle-angle');
}

function renderCheck() {
  const current = pack.checks[check];
  $('guided-title').textContent = `Check yourself · ${check + 1}/${pack.checks.length}`;
  $('guided-prompt').textContent = current.question;
  $('guided-feedback').textContent = 'Choose an answer, then use Next to continue.';
  $('guided-back').disabled = check <= 0;
  $('guided-next').textContent = check === pack.checks.length - 1 ? 'Finish check' : 'Next question';
  const answers = $('guided-answers'); answers.replaceChildren();
  current.answers.forEach((answer, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = answer;
    button.onclick = () => {
      [...answers.children].forEach(item => item.disabled = true);
      const correct = index === current.correct;
      button.classList.toggle('btn-primary', correct);
      $('guided-feedback').textContent = `${correct ? 'Correct.' : 'Not quite.'} ${current.rationale}`;
    };
    answers.append(button);
  });
}

function render() {
  if (mode.value === 'explore') return showExplore();
  panel.hidden = false;
  $('training-mode-note').textContent = mode.value === 'learn' ? 'Guided prompts use the same model controls; make a prediction before revealing each pose.' : pack.privacy;
  if (mode.value === 'learn') renderLearn(); else renderCheck();
}

mode.onchange = () => { step = -1; check = 0; if (mode.value === 'learn') step = 0; render(); };
$('guided-next').onclick = () => {
  if (mode.value === 'learn') { if (step < lesson.steps.length - 1) step++; else { mode.value = 'explore'; } }
  else if (check < pack.checks.length - 1) check++; else { mode.value = 'explore'; }
  render();
};
$('guided-back').onclick = () => { if (mode.value === 'learn') step = Math.max(0, step - 1); else check = Math.max(0, check - 1); render(); };

if (model.lesson_url) {
  try {
    pack = await fetch(model.lesson_url).then(response => { if (!response.ok) throw Error('Lesson pack unavailable'); return response.json(); });
    lesson = pack.lessons[0];
    mode.querySelectorAll('option:not([value="explore"])').forEach(option => option.disabled = false);
  } catch (error) {
    mode.querySelectorAll('option:not([value="explore"])').forEach(option => option.disabled = true);
    $('training-mode-note').textContent = 'Guided lessons are unavailable; free exploration remains available.';
    console.warn(error);
  }
} else mode.querySelectorAll('option:not([value="explore"])').forEach(option => option.disabled = true);
showExplore();
