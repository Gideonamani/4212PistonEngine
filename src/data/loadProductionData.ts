import type {
  CourseTrack,
  Lesson,
  LessonStep,
  QuizModule,
  QuizQuestion,
} from '../types/engine';

type PackStep = {
  type: 'text' | 'image' | 'model-pose' | 'external-link' | 'web-embed';
  title: string;
  prompt: string;
  note?: string;
  modelId?: string;
  action?: { type: string; value?: number | string };
  url?: string;
  alt?: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
  sourceRefs?: string[];
  mediaPlan?: LessonStep['mediaPlan'];
};

type PackLesson = {
  id: string;
  title: string;
  objective: string;
  models?: string[];
  steps: PackStep[];
  sequenceNumber?: number;
};

type PackCheck = {
  id: string;
  lessonId: string;
  type: 'multiple-choice' | 'ordering';
  question: string;
  hint?: string;
  answers?: string[];
  correct?: number;
  items?: string[];
  rationale: string;
};

type LessonPack = {
  id: string;
  title: string;
  description: string;
  lessons: PackLesson[];
  checks: PackCheck[];
};

type LessonsManifest = { packs: string[] };

export type ProductionCurriculum = {
  tracks: CourseTrack[];
  quizModules: QuizModule[];
};

const visualFor = (text: string): Lesson['imageType'] => {
  const value = text.toLowerCase();
  if (value.includes('wright') || value.includes('aircraft')) return 'wright';
  if (value.includes('steam') || value.includes('history')) return 'oxen';
  if (value.includes('maint') || value.includes('inspect')) return 'maintenance';
  if (value.includes('diagnos') || value.includes('gauge')) return 'gauges';
  if (value.includes('bore')) return 'borescope';
  if (value.includes('system')) return 'systems';
  return 'piston';
};

const stepVisualFor = (text: string): LessonStep['imageType'] => {
  const value = text.toLowerCase();
  if (value.includes('steam')) return 'steam';
  if (value.includes('wright') || value.includes('flight')) return 'wright';
  if (value.includes('animal') || value.includes('muscle') || value.includes('labour')) return 'oxen';
  if (value.includes('gauge') || value.includes('pressure')) return 'gauges';
  if (value.includes('inspect') || value.includes('bore')) return 'borescope';
  if (value.includes('system') || value.includes('fadec')) return 'systems';
  return 'piston';
};

const modelLabel = (modelId?: string) => {
  if (modelId === 'cylinder') return 'Detailed operating cylinder';
  if (modelId === 'gtsio520-h-v5-teaching-engine') return 'Full six-cylinder engine';
  if (modelId === 'wright-1903') return 'Wright 1903 reference model';
  return modelId || 'Detailed operating cylinder';
};

const supportedModels = new Set(['cylinder', 'gtsio520-h-v5-teaching-engine']);

function mapLesson(lesson: PackLesson, index: number): Lesson {
  const steps = lesson.steps.map((step, stepIndex): LessonStep => ({
    type: step.type,
    stepNumber: stepIndex + 1,
    title: step.title,
    text: step.prompt,
    imageType: stepVisualFor(`${step.title} ${step.prompt}`),
    suggestedAnswer: step.note,
    has3DReference: step.type === 'model-pose' && supportedModels.has(step.modelId || ''),
    referenceModel: modelLabel(step.modelId),
    note: step.note,
    action: step.action,
    url: step.url,
    alt: step.alt,
    credit: step.credit,
    license: step.license,
    sourceUrl: step.sourceUrl,
    sourceRefs: step.sourceRefs,
    mediaPlan: step.mediaPlan,
  }));

  return {
    id: lesson.id,
    lessonNumber: `Lesson ${String(lesson.sequenceNumber || index + 1).padStart(2, '0')}`,
    title: lesson.title,
    subtitle: lesson.objective,
    description: lesson.objective,
    stepCount: steps.length,
    hasModelBadge: Boolean(lesson.models?.length || steps.some((step) => step.has3DReference)),
    imageType: visualFor(`${lesson.title} ${lesson.objective}`),
    steps,
  };
}

function mapQuestion(check: PackCheck, packId: string): QuizQuestion {
  const options = check.answers || [];
  return {
    id: check.id,
    lessonId: check.lessonId,
    type: check.type,
    question: check.question,
    options,
    correctIndex: check.correct ?? -1,
    items: check.items,
    hint: check.hint,
    explanation: check.rationale,
    category: packId.includes('cylinder') ? '4stroke' : 'components',
  };
}

function mapTrack(pack: LessonPack, index: number): CourseTrack {
  const lessons = pack.lessons.map(mapLesson);
  const stepCount = lessons.reduce((sum, lesson) => sum + lesson.stepCount, 0);
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    lessonCount: lessons.length,
    stepCountApprox: `${stepCount} steps`,
    progressPercent: 0,
    isCurrent: index === 0,
    imageType: visualFor(`${pack.title} ${pack.description}`) === 'piston' ? 'radial' : visualFor(`${pack.title} ${pack.description}`) as CourseTrack['imageType'],
    lessons,
  };
}

function mapQuizModule(pack: LessonPack): QuizModule {
  const questions = pack.checks.map((check) => mapQuestion(check, pack.id));
  return {
    id: `${pack.id}-check`,
    title: pack.title,
    subtitle: pack.description,
    description: `Assessment questions from ${pack.title}.`,
    category: pack.id.includes('cylinder') ? '4stroke' : 'components',
    questionCount: questions.length,
    approxMinutes: `${Math.max(3, Math.ceil(questions.length * 1.5))} min`,
    badge: pack.id.includes('cylinder') ? 'OPERATING CYCLE' : 'FOUNDATIONS',
    imageType: pack.id.includes('cylinder') ? 'piston' : 'radial',
    questions,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadProductionData(): Promise<ProductionCurriculum> {
  const manifest = await fetchJson<LessonsManifest>('./lessons-manifest.json');
  const packs = await Promise.all(manifest.packs.map((path) => fetchJson<LessonPack>(path)));
  return {
    tracks: packs.filter((pack) => pack.lessons?.length).map(mapTrack),
    quizModules: packs.filter((pack) => pack.checks?.length).map(mapQuizModule),
  };
}
