export type LessonProgress = {
  completedAt?: string;
  currentStep?: number;
  reflection?: string;
};

type ProgressStore = Record<string, LessonProgress>;

const STORAGE_KEY = '4212-piston-engine:lesson-progress:v1';
export const LESSON_PROGRESS_EVENT = 'lesson-progress-change';

const readStore = (): ProgressStore => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as ProgressStore : {};
  } catch {
    return {};
  }
};

const writeLessonProgress = (lessonId: string, update: Partial<LessonProgress>) => {
  const store = readStore();
  store[lessonId] = { ...store[lessonId], ...update };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(LESSON_PROGRESS_EVENT, { detail: { lessonId } }));
  } catch {
    // The lesson still works when storage is unavailable (for example, private browsing limits).
  }
  return store[lessonId];
};

export const getLessonProgress = (lessonId: string): LessonProgress => readStore()[lessonId] || {};

export const getCompletedLessonIds = () => new Set(
  Object.entries(readStore()).filter(([, progress]) => Boolean(progress.completedAt)).map(([lessonId]) => lessonId),
);

export const saveLessonStep = (lessonId: string, currentStep: number) => writeLessonProgress(lessonId, { currentStep });

export const completeLesson = (lessonId: string, finalStep: number) => writeLessonProgress(lessonId, {
  completedAt: new Date().toISOString(),
  currentStep: finalStep,
});

export const saveLessonReflection = (lessonId: string, reflection: string) => writeLessonProgress(lessonId, { reflection });
