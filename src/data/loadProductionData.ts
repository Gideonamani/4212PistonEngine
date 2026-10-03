import type { CourseTrack, QuizModule } from '../types/engine';
import { modelLabel, modelsById } from './modelRegistry';
import { mapQuizModule, mapTrack, type LessonPack, type ModelLookup } from './packMapping';

type LessonsManifest = { packs: string[] };

export type ProductionCurriculum = {
  tracks: CourseTrack[];
  quizModules: QuizModule[];
};

const models: ModelLookup = { has: (modelId) => Boolean(modelId && modelsById[modelId]), label: modelLabel };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadProductionData(): Promise<ProductionCurriculum> {
  const manifest = await fetchJson<LessonsManifest>('./lessons-manifest.json');
  const packs = await Promise.all(manifest.packs.map((path) => fetchJson<LessonPack>(path)));
  return {
    tracks: packs.filter((pack) => pack.lessons?.length).map((pack, index) => mapTrack(pack, index, models)),
    quizModules: packs.filter((pack) => pack.checks?.length).map(mapQuizModule),
  };
}
