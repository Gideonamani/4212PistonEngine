import type {
  CourseTrack,
  Lesson,
  LessonStep,
  QuizModule,
  QuizQuestion,
} from '../types/engine';

// Turns lesson packs (the JSON in web/) into the objects the screens use. No imports from the model registry or the network, so
// the same code runs under `node --test` against the shipped packs.

/** What the mapper needs to know about the 3D models, passed in so this module stays free of JSON imports. */
export type ModelLookup = {
  has: (modelId?: string) => boolean;
  label: (modelId?: string) => string;
};

/**
 * A step as written in a pack: every LessonStep field that passes through unchanged, plus `prompt`, which becomes the body text.
 * Adding a field to LessonStep is therefore enough for it to reach the screens.
 */
export type PackStep = Omit<LessonStep, 'stepNumber' | 'text' | 'imageType' | 'suggestedAnswer' | 'has3DReference' | 'referenceModel' | 'promptQuestion' | 'promptPlaceholder'> & {
  type: NonNullable<LessonStep['type']>;
  prompt: string;
};

export type PackLesson = {
  id: string;
  thumbnail?: string;
  title: string;
  objective: string;
  models?: string[];
  steps: PackStep[];
  sequenceNumber?: number;
  listed?: boolean;
};

export type PackCheck = {
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

export type LessonPack = {
  id: string;
  thumbnail?: string;
  title: string;
  description: string;
  lessons: PackLesson[];
  checks: PackCheck[];
};

// Lessons with listed:false never appear in the lesson list. Those a step links to (deepDiveLinks) are deep dives, reachable
// through that link; the rest are parked drafts that students never see, along with their checks.
const isListed = (lesson: PackLesson) => lesson.listed !== false;
const linkedDeepDiveIds = (pack: LessonPack) => new Set(pack.lessons.flatMap((lesson) => lesson.steps.flatMap((step) => step.deepDiveLinks || [])));
const isDeepDive = (lesson: PackLesson, linked: Set<string>) => !isListed(lesson) && linked.has(lesson.id);

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

export function mapStep(step: PackStep, index: number, models: ModelLookup): LessonStep {
  const { prompt, ...passThrough } = step;
  return {
    ...passThrough,
    stepNumber: index + 1,
    text: prompt,
    imageType: stepVisualFor(`${step.title} ${prompt}`),
    suggestedAnswer: step.note,
    has3DReference: step.type === 'model-pose' && models.has(step.modelId),
    referenceModel: models.label(step.modelId),
  };
}

export function mapLesson(lesson: PackLesson, index: number, models: ModelLookup, deepDive = false): Lesson {
  const steps = lesson.steps.map((step, stepIndex) => mapStep(step, stepIndex, models));
  return {
    id: lesson.id,
    lessonNumber: deepDive ? 'Deep dive' : `Lesson ${String(lesson.sequenceNumber || index + 1).padStart(2, '0')}`,
    isDeepDive: deepDive || undefined,
    title: lesson.title,
    subtitle: lesson.objective,
    description: lesson.objective,
    stepCount: steps.length,
    hasModelBadge: Boolean(lesson.models?.length || steps.some((step) => step.has3DReference)),
    imageType: visualFor(`${lesson.title} ${lesson.objective}`),
    thumbnail: lesson.thumbnail,
    steps,
  };
}

export function mapQuestion(check: PackCheck, packId: string): QuizQuestion {
  return {
    id: check.id,
    lessonId: check.lessonId,
    type: check.type,
    question: check.question,
    options: check.answers || [],
    correctIndex: check.correct ?? -1,
    items: check.items,
    hint: check.hint,
    explanation: check.rationale,
    category: packId.includes('cylinder') ? '4stroke' : 'components',
  };
}

export function mapTrack(pack: LessonPack, index: number, models: ModelLookup): CourseTrack {
  const linked = linkedDeepDiveIds(pack);
  const lessons = pack.lessons.filter(isListed).map((lesson, lessonIndex) => mapLesson(lesson, lessonIndex, models));
  const deepDives = pack.lessons.filter((lesson) => isDeepDive(lesson, linked)).map((lesson, lessonIndex) => mapLesson(lesson, lessonIndex, models, true));
  const stepCount = lessons.reduce((sum, lesson) => sum + lesson.stepCount, 0);
  const visual = visualFor(`${pack.title} ${pack.description}`);
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    lessonCount: lessons.length,
    stepCountApprox: `${stepCount} steps`,
    progressPercent: 0,
    isCurrent: index === 0,
    imageType: visual === 'piston' ? 'radial' : visual as CourseTrack['imageType'],
    thumbnail: pack.thumbnail,
    lessons,
    deepDives,
  };
}

export function mapQuizModule(pack: LessonPack): QuizModule {
  const linked = linkedDeepDiveIds(pack);
  const unlisted = new Set(pack.lessons.filter((lesson) => !isListed(lesson) && !isDeepDive(lesson, linked)).map((lesson) => lesson.id));
  const questions = pack.checks.filter((check) => !unlisted.has(check.lessonId)).map((check) => mapQuestion(check, pack.id));
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
    thumbnail: pack.thumbnail,
    questions,
  };
}
