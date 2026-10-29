import type { ModelHotspot } from '../viewer/types';
import registryData from './models.json';

export type ModelAdapterId = 'static-gltf' | 'operating-cylinder' | 'full-engine' | 'animated-study';

/**
 * The five things a model can offer, in the order the gallery shows them. The set is closed: a card shows the icon for each one the
 * model really has, so a new kind needs an icon and a legend entry in src/components/ModelCapabilities.tsx first.
 */
export const MODEL_CAPABILITY_KINDS = ['animated', 'exploded', 'section', 'parts', 'tour'] as const;
export type ModelCapabilityKind = (typeof MODEL_CAPABILITY_KINDS)[number];
/** `note` is what the icon's tooltip says about this model in particular ("61 named components"). */
export type ModelCapability = { kind: ModelCapabilityKind; note: string };

export type ModelSource = {
  localUrl?: string;
  driveId?: string;
  compressed?: boolean;
  transferBytes?: number;
  decodedBytes?: number;
};

export type ModelDefinition = {
  id: string;
  /** The full name: the model picker's key, and what the accessible name of the viewer says. */
  label: string;
  /** The name that fits a gallery tile and the viewer's controls panel. */
  shortLabel: string;
  adapter: ModelAdapterId;
  /** Replaces the default `GTSIO-520-H · <label>` header subtitle while the model is open (for a model that is not the teaching engine). */
  headerLabel?: string;
  /** One or two sentences under the title in the viewer: what the model is, and what it is not (a reconstruction, a work in progress, illustrative motion). About 110 characters. */
  summary: string;
  /** The icons under the tile, in MODEL_CAPABILITY_KINDS order; each is a claim the model keeps. */
  capabilities: ModelCapability[];
  previewUrl?: string;
  /** How the model is coloured when it opens: its own inspection colours (the default) or the file's original ones. A reconstruction whose materials carry meaning (steel, cast iron, bronze) opens in `cad`. */
  defaultAppearance?: 'inspection' | 'cad';
  lessonControls?: boolean;
  sources?: ModelSource[];
  componentCatalogueUrl?: string;
  motionProfileUrl?: string;
  savedMotionsUrl?: string;
  contractUrl?: string;
  /** Learner-facing part names and explanations (e.g. web/gtsio520-r10-parts.json), projected from the part store (knowledge/part-cards/parts, docs/part-store.md). Its `model` field must equal this model's id. */
  partDetailsUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  license?: string;
  lessonHotspotIds?: string[];
  hotspots?: ModelHotspot[];
  viewPresets?: Record<string, { direction: [number, number, number] }>;
  /** How far back the camera sits when the model is framed (the default, about 1.1, leaves room around the bounding sphere). Below 1 fills more of the frame; use it for scans whose stray geometry inflates that sphere. */
  fitPadding?: number;
};

export const modelRegistry = registryData as ModelDefinition[];

export const modelsById = Object.fromEntries(modelRegistry.map((model) => [model.id, model])) as Record<string, ModelDefinition>;
export const modelsByLabel = Object.fromEntries(modelRegistry.map((model) => [model.label, model])) as Record<string, ModelDefinition>;

export function modelLabel(modelId?: string) {
  return (modelId && modelsById[modelId]?.label) || modelId || modelRegistry[0].label;
}
