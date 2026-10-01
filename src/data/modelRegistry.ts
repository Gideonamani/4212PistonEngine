import type { ModelHotspot } from '../viewer/types';
import registryData from './models.json';

export type ModelAdapterId = 'static-gltf' | 'operating-cylinder' | 'full-engine' | 'animated-study';

export type ModelSource = {
  localUrl?: string;
  driveId?: string;
  compressed?: boolean;
  transferBytes?: number;
  decodedBytes?: number;
};

export type ModelDefinition = {
  id: string;
  label: string;
  adapter: ModelAdapterId;
  eyebrow: string;
  description: string;
  previewUrl?: string;
  imageType: 'piston' | 'systems' | 'wright';
  badges: string[];
  sources?: ModelSource[];
  componentCatalogueUrl?: string;
  motionProfileUrl?: string;
  savedMotionsUrl?: string;
  contractUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  license?: string;
  lessonHotspotIds?: string[];
  hotspots?: ModelHotspot[];
  viewPresets?: Record<string, { direction: [number, number, number] }>;
};

export const modelRegistry = registryData as ModelDefinition[];

export const modelsById = Object.fromEntries(modelRegistry.map((model) => [model.id, model])) as Record<string, ModelDefinition>;
export const modelsByLabel = Object.fromEntries(modelRegistry.map((model) => [model.label, model])) as Record<string, ModelDefinition>;

export function modelLabel(modelId?: string) {
  return (modelId && modelsById[modelId]?.label) || modelId || modelRegistry[0].label;
}
