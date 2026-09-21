const $ = id => document.getElementById(id);
const shell = $('shell');
const listPanel = $('list-panel');
const lessonListEl = $('lesson-list');
const stepPanel = $('step-panel');
const hideListBtn = $('hide-list');

let lessons = [];
let registry = { models: [] };
let currentLessonIndex = 0;
let currentStepIndex = 0; // -1 means the completion screen

function findModel(modelId) {
  return registry.models.find(model => model.id === modelId);
}

async function loadLessons() {
  const manifest = await fetch('./lessons-manifest.json').then(r => r.json());
  const packs = await Promise.all(manifest.packs.map(url => fetch(url).then(r => {
    if (!r.ok) throw Error(`Lesson pack unavailable: ${url}`);
    return r.json();
  })));
  return packs.flatMap(pack => pack.lessons).filter(lesson => lesson.listed !== false);
}

async function loadRegistry() {
  try {
    return await fetch('./models.json').then(r => r.json());
  } catch {
    return { models: [] };
  }
}

function renderList() {
  lessonListEl.replaceChildren();
  lessons.forEach((lesson, index) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'lesson-item';
    btn.type = 'button';
    btn.setAttribute('aria-current', String(index === currentLessonIndex));
    const stepCount = lesson.steps.length;
    btn.innerHTML = `<span class="lesson-num">LESSON ${String(index + 1).padStart(2, '0')}</span>` +
      `<span class="lesson-title">${lesson.title}</span>` +
      `<span class="lesson-meta">${stepCount} step${stepCount === 1 ? '' : 's'}${lesson.models.length ? ' · has a reference model' : ''}</span>`;
    btn.onclick = () => {
      currentLessonIndex = index;
      currentStepIndex = 0;
      renderList();
      renderStep();
      if (window.matchMedia('(max-width: 860px)').matches) setListHidden(true);
    };
    li.append(btn);
    lessonListEl.append(li);
  });
}

function evidenceTag(note) {
  if (!note) return '';
  if (/^Documented/.test(note)) return '<span class="evidence-tag documented">Documented</span>';
  if (/^General/.test(note) || /^Reflective/.test(note)) return '<span class="evidence-tag illustrative">General / illustrative</span>';
  return '';
}

function renderStepContent(step) {
  if (step.type === 'text') {
    return `<div class="step-card">
      <p class="step-prompt">${step.prompt}</p>
      ${evidenceTag(step.note)}
      ${step.note ? `<p class="step-note">${step.note}</p>` : ''}
    </div>`;
  }
  if (step.type === 'image') {
    const isPlaceholder = (step.url || '').startsWith('PLACEHOLDER:');
    return `<div class="step-card">
      <p class="step-prompt">${step.prompt}</p>
      ${isPlaceholder ? `<div class="placeholder-box">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        <span class="placeholder-label">Image not yet sourced</span>
        <span class="placeholder-caption">${step.url.replace('PLACEHOLDER:', '')}</span>
      </div>` : `<img src="${step.url}" alt="${step.prompt}" style="width:100%;border-radius:8px;margin-top:12px">`}
      ${step.note ? `<p class="step-note">${step.note}</p>` : ''}
    </div>`;
  }
  if (step.type === 'model-pose') {
    const model = findModel(step.modelId);
    return `<div class="step-card">
      <p class="step-prompt">${step.prompt}</p>
      ${model ? `<div class="model-card">
        <div class="model-card-text"><span class="model-card-label">3D reference model</span><span class="model-card-name">${model.label}</span></div>
        <a class="open-btn" href="./training.html?model=${model.id}" target="_blank" rel="noopener">Open 3D view →</a>
      </div>` : `<div class="placeholder-box">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span class="placeholder-label">3D reference model not yet available</span>
        <span class="placeholder-caption">Registry id "${step.modelId}" has no asset or registry entry yet.</span>
      </div>`}
      ${evidenceTag(step.note)}
      ${step.note ? `<p class="step-note">${step.note}</p>` : ''}
      ${model && model.hasTeachingComponents ? `<a class="explore-link" href="./training.html?model=${model.id}">Explore this fully →</a>` : ''}
    </div>`;
  }
  if (step.type === 'web-embed' || step.type === 'external-link') {
    return `<div class="step-card">
      <p class="step-prompt">${step.prompt}</p>
      ${step.url ? `<p class="step-note"><a href="${step.url}" target="_blank" rel="noopener">${step.url} →</a></p>` : ''}
      ${step.note ? `<p class="step-note">${step.note}</p>` : ''}
    </div>`;
  }
  return `<div class="step-card"><p class="step-prompt">${step.prompt}</p></div>`;
}

function renderDeepDives(step) {
  if (!step.deepDiveLinks || !step.deepDiveLinks.length) return '';
  return `<p class="deep-dive">Want to go deeper?${step.deepDiveLinks.map(id => `<a href="#" data-deepdive="${id}">${id}</a>`).join(', ')}</p>`;
}

function renderStep() {
  const lesson = lessons[currentLessonIndex];
  if (!lesson) { stepPanel.innerHTML = '<p class="empty-state">No lessons available.</p>'; return; }
  const totalSteps = lesson.steps.length;
  const onCompletion = currentStepIndex >= totalSteps;
  const step = onCompletion ? null : lesson.steps[currentStepIndex];

  const progressPct = onCompletion ? 100 : Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  const head = `<div class="lesson-head">
    <div class="lesson-kicker"><span>Learn · Lesson ${currentLessonIndex + 1} of ${lessons.length}</span></div>
    <h1>${lesson.title}</h1>
    <p class="objective">${lesson.objective}</p>
  </div>`;

  const progress = `<div class="step-progress">
    <span class="count">${onCompletion ? 'COMPLETE' : `STEP ${String(currentStepIndex + 1).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}`}</span>
    <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%"></div></div>
    ${step ? `<span class="step-type-tag">${step.type.replace('-', ' ')}</span>` : ''}
  </div>`;

  const body = onCompletion
    ? `<div class="completion-card">
        <div class="completion-label">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          Lesson complete
        </div>
        <p>${lesson.completionCriteria || 'Review what you just covered before moving to the next lesson.'}</p>
      </div>`
    : renderStepContent(step) + renderDeepDives(step);

  const controls = `<div class="step-controls">
    <button class="nav-btn" id="back-btn" type="button" ${currentStepIndex <= 0 ? 'disabled' : ''}>← Back</button>
    <button class="nav-btn primary" id="next-btn" type="button">${onCompletion ? 'Back to lesson list' : (currentStepIndex === totalSteps - 1 ? 'Finish lesson' : 'Next →')}</button>
  </div>`;

  stepPanel.innerHTML = head + progress + body + controls;

  $('back-btn').onclick = () => { currentStepIndex = Math.max(0, currentStepIndex - 1); renderStep(); window.scrollTo(0, 0); };
  $('next-btn').onclick = () => {
    if (onCompletion) { listPanel.hidden = false; shell.classList.add('list-visible'); return; }
    currentStepIndex += 1;
    renderStep();
    window.scrollTo(0, 0);
  };
}

function setListHidden(hidden) {
  shell.classList.toggle('list-hidden', hidden);
  hideListBtn.setAttribute('aria-expanded', String(!hidden));
  hideListBtn.textContent = hidden ? 'Show list' : 'Hide list';
}

hideListBtn.onclick = () => setListHidden(!shell.classList.contains('list-hidden'));

try {
  [lessons, registry] = await Promise.all([loadLessons(), loadRegistry()]);
  if (!lessons.length) throw Error('No lessons found');
  renderList();
  renderStep();
} catch (error) {
  stepPanel.innerHTML = `<p class="empty-state">Lessons are unavailable right now (${error.message}).</p>`;
  console.error(error);
}
