/**
 * Learner-facing part details for the models that have them (the GTSIO-520-H whole engine and the operating cylinder).
 *
 * web/<model>-parts.json is built from the part store (knowledge/part-cards/parts/, see docs/part-store.md): the definitions
 * the model uses, plus a table that maps every part id to its definition and to what tells it from the others of its kind
 * ("cylinder 3 · intake"). Where a model words a part differently from its definition, `overrides` carries that wording for
 * that part only. Only the student fields ship. The catalogue cross-check (figure keys, alignment) stays in the store's
 * engineering block and never reaches the browser.
 *
 * Every definition is 'draft' until the instructor has reviewed it; the part card says so.
 */

export type ClaimStatus = 'specified' | 'derived' | 'inferred' | 'illustrative';

/** One statement for a learner, with the evidence behind it: a `source` for specified/derived, a `basis` for inferred/illustrative. */
export type Claim = { text: string; status: ClaimStatus; source?: string; basis?: string };

export type LessonMention = { lesson: number; title: string; mentions: number };

export type LearnerDefinition = {
  family: string;
  review: 'draft' | 'reviewed';
  title: Claim;
  /** Tells apart definitions that share a title ("Screw" for nine fasteners): "camshaft gear". Empty when the title is unique. */
  context: string;
  aliases: string[];
  system: string;
  function: Claim;
  madeOf: Claim;
  sits: Claim;
  worksWith: { ids: string[]; titles: string[]; status: ClaimStatus; source?: string; basis?: string };
  lookFor: Claim;
  catalogue: { description: string; note: string } | null;
  lessons: LessonMention[];
};

/** What one model says about one part in place of its definition's wording: its own lines, system or review state. */
export type PartOverride = Partial<Pick<LearnerDefinition, 'function' | 'madeOf' | 'sits' | 'review'>> & { system?: string };

export type LearnerPartsFile = {
  schema: string;
  model: string;
  state: 'draft' | 'reviewed';
  systems: { id: string; label: string; question: string }[];
  statuses: Record<ClaimStatus, string>;
  definitions: Record<string, LearnerDefinition>;
  /** part id -> [definition id, what tells it from the others of its kind] */
  parts: Record<string, [string, string]>;
  /** part id -> the model's own wording for that part; absent when no part has any */
  overrides?: Record<string, PartOverride>;
};

/** Each model's file is named for it: "gtsio520-r10-parts/1", "cylinder-parts/1". */
const PARTS_SCHEMA = /^[a-z0-9]+(?:-[a-z0-9]+)*-parts\/1$/;

/** What the part card and the Parts list show for one part. */
export type LearnerPart = {
  partId: string;
  definitionId: string;
  title: string;
  /** The title with the evidence for it. */
  titleClaim: Claim;
  /** "camshaft gear": see LearnerDefinition.context. */
  context: string;
  /** "cylinder 3 · intake": empty when the part is the only one of its kind. */
  instance: string;
  /** Title, context, then instance: the Parts list and the card heading. */
  label: string;
  review: 'draft' | 'reviewed';
  aliases: string[];
  /** The system the part belongs to, with the question that system answers ("How is combustion started?"). */
  system: { id: string; label: string; question?: string };
  function: Claim;
  madeOf: Claim;
  sits: Claim;
  worksWith: LearnerDefinition['worksWith'];
  lookFor: Claim;
  catalogue: LearnerDefinition['catalogue'];
  lessons: LessonMention[];
};

/** The shape check a downloaded file must pass before the viewer trusts it; a bad file is ignored, never half-used. */
export function parseLearnerParts(value: unknown): LearnerPartsFile | undefined {
  const file = value as Partial<LearnerPartsFile> | null;
  if (!file || typeof file !== 'object') return undefined;
  if (typeof file.schema !== 'string' || !PARTS_SCHEMA.test(file.schema)) return undefined;
  if (!file.definitions || typeof file.definitions !== 'object' || !file.parts || typeof file.parts !== 'object') return undefined;
  if (!Array.isArray(file.systems)) return undefined;
  return file as LearnerPartsFile;
}

/** Fetches the learner file. Failing to load it is not an error for the viewer: the model opens with its own labels. */
export async function loadLearnerParts(url: string, modelId: string, signal?: AbortSignal): Promise<LearnerPartsFile | undefined> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return undefined;
    const file = parseLearnerParts(await response.json());
    // The details were written for one model's part ids; they never apply to another.
    return file && file.model === modelId ? file : undefined;
  } catch (error) {
    if (signal?.aborted) throw error;
    return undefined;
  }
}

/** The learner view of one part, or undefined when the file does not know it. */
export function learnerPartFor(file: LearnerPartsFile | undefined, partId: string): LearnerPart | undefined {
  const entry = file?.parts[partId];
  const definition = entry ? file?.definitions[entry[0]] : undefined;
  if (!file || !entry || !definition) return undefined;
  const title = definition.title.text;
  const instance = entry[1];
  const own = file.overrides?.[partId];
  const systemId = own?.system ?? definition.system;
  const system = file.systems.find((item) => item.id === systemId);
  return {
    partId,
    definitionId: entry[0],
    title,
    titleClaim: definition.title,
    context: definition.context,
    instance,
    label: [title, definition.context, instance].filter(Boolean).join(' · '),
    review: own?.review ?? definition.review,
    aliases: definition.aliases,
    system: { id: systemId, label: system?.label ?? systemId, question: system?.question },
    function: own?.function ?? definition.function,
    madeOf: own?.madeOf ?? definition.madeOf,
    sits: own?.sits ?? definition.sits,
    worksWith: definition.worksWith,
    lookFor: definition.lookFor,
    catalogue: definition.catalogue,
    lessons: definition.lessons,
  };
}

/** Extra words the Parts search matches besides the label and the function: other names, the catalogue noun, the system. */
export function learnerSearchText(part: LearnerPart): string {
  return [...part.aliases, part.catalogue?.description ?? '', part.system.label].filter(Boolean).join(' ');
}

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  specified: 'Stated in a source',
  derived: 'Worked out from a source',
  inferred: 'Reasoned, not in a source',
  illustrative: 'Learning prompt',
};
