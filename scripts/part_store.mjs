// The part store, read from Node: loads knowledge/part-cards/parts/ and projects the learner-only file one model ships.
//
// The store holds three levels (docs/part-store.md): definitions (what a kind of part is, with a `student` block a learner may read once
// reviewed and an `engineering` block that never ships), instances (which of a model's part ids is which definition) and flat systems.
// Validation is Python's job (cad_pipeline/intent/part_store.py runs in CI); this module reads the store, resolves a model's instances
// and writes the student-only projection. The patterns below scan what ships, as a second line of defence against part numbers.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STORE_DIR = path.join(ROOT, 'knowledge/part-cards/parts');
export const STORE_PATH = path.join(STORE_DIR, 'store.json');
export const DEFINITIONS_DIR = path.join(STORE_DIR, 'definitions');
export const INSTANCES_DIR = path.join(STORE_DIR, 'instances');
export const R10_MODEL_ID = 'gtsio520-h-r10-mechanism-study';
export const CYLINDER_MODEL_ID = 'cylinder';

// A catalogue part number (not a form number such as X-30040A), a PartStream/H1B mention, or a reference to the old card.
export const CATALOGUE_DATA = /(?<![-\w])\d{5,6}[A-Z]?\d*\b|H1B|PartStream|earlier card/;

// Catalogue and part numbers must never reach a learner, wherever they appear.
export const PART_NUMBER_PATTERNS = [
  /P\/N/i, /\bAN\d/, /\bMS\d/, /\bX\d{4}/,
  /\b\d{5,6}[A-Z]?\d*\b/, // five- or six-digit catalogue numbers
  /\bQTY\b/i, /\bTODO\b/i, /\bTBD\b/i, /lorem/i, /placeholder/i,
];

// Engineering specifications: not for the plain-English lines. The 'catalogue' details line may carry sizes and
// thread names, so it is checked against the part-number patterns only.
export const SPEC_PATTERNS = [
  /\bAMS\s?\d/i, /\bNPT/i, /\bUNJ?F/i, /carburi[sz]/i, /case-hardened/i, /nitrid/i, /Rockwell/i, /\bHRC\b/i,
  /\bpsi\b/i, /\blbf\b/i, /ft-?lb/i,
];

export const BANNED_STUDENT_PATTERNS = [...PART_NUMBER_PATTERNS, ...SPEC_PATTERNS];

// Word limits for the student text (the function line is the one learners read first). The Python validator holds the same numbers.
export const LIMITS = { title: 4, function: 22, madeOf: 8, sits: 28, lookFor: 22, context: 3 };

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function loadStore() {
  const store = readJson(STORE_PATH);
  const sets = readdirSync(DEFINITIONS_DIR).filter((name) => name.endsWith('.json')).sort().map((name) => readJson(path.join(DEFINITIONS_DIR, name)));
  const instances = readdirSync(INSTANCES_DIR).filter((name) => name.endsWith('.json')).sort().map((name) => readJson(path.join(INSTANCES_DIR, name)));
  const definitions = sets.flatMap((set) => set.definitions);
  return { store, sets, definitions, instances };
}

export function instanceDocFor(loaded, modelId) {
  const doc = loaded.instances.find((item) => item.model === modelId);
  if (!doc) throw new Error(`the part store has no instance file for ${modelId}`);
  return doc;
}

/** The part ids a model's data file lists (where the instance file says to look). */
export function modelPartIds(instanceDoc, root = ROOT) {
  const { file, list, key } = instanceDoc.idsFrom;
  const data = readJson(path.join(root, file));
  return data[list].map((item) => item[key]);
}

/** Every model that ships learner part details: its instance file names the file to write. */
export function projectedModels(loaded) {
  return loaded.instances.filter((doc) => doc.projection);
}

const WORD = { L: 'left', R: 'right', CaseSeal: 'case seal', HeadPacking: 'head packing' };
const lowerWord = (value) => WORD[value] ?? value.toLowerCase();

/**
 * What tells one part of a kind from another, in plain words: "cylinder 3 · intake", "left", "throw 2 · AL".
 * Built from the named groups in the part id; `instanceWords` renames the numbered group where "no. N" would mislead.
 */
export function instanceLabel(groups = {}, words = {}) {
  const bits = [];
  if (groups.cyl) bits.push(`cylinder ${groups.cyl}`);
  if (groups.n) bits.push(`${words.n ?? 'no.'} ${groups.n}`);
  if (groups.side) bits.push(lowerWord(groups.side));
  if (groups.end) bits.push(lowerWord(groups.end));
  if (groups.pos) bits.push(/^(?:[A-Z]{1,2})$/.test(groups.pos) ? groups.pos : lowerWord(groups.pos));
  if (groups.set) bits.push(words.sets?.[groups.set] ?? lowerWord(groups.set));
  return bits.join(' · ');
}

/**
 * Resolve a model's instances: each part id to exactly one definition, by an explicit row or by one of the instance file's id patterns.
 * Returns the rows by part id (definition, label, and any per-part system, claims and review), and the ids with none or with several.
 */
export function mapParts(instanceDoc, partIds) {
  const regs = (instanceDoc.rules ?? []).map((rule) => ({ rule, regs: rule.match.map((pattern) => new RegExp(`^(?:${pattern})$`)) }));
  const explicit = new Map((instanceDoc.parts ?? []).map((row) => [row.id, row]));
  const rows = {};
  const unmatched = [];
  const ambiguous = [];
  for (const pid of partIds) {
    const hits = [];
    if (explicit.has(pid)) {
      const row = explicit.get(pid);
      hits.push({ definition: row.definition, label: row.instance ?? '', row });
    }
    for (const { rule, regs: list } of regs) {
      for (const re of list) {
        const found = re.exec(pid);
        if (found) {
          hits.push({ definition: rule.definition, label: instanceLabel(found.groups ?? {}, rule.instanceWords ?? {}), row: undefined });
          break;
        }
      }
    }
    if (hits.length === 0) unmatched.push(pid);
    else if (hits.length > 1) ambiguous.push({ part: pid, definitions: hits.map((hit) => hit.definition) });
    else rows[pid] = hits[0];
  }
  return { rows, unmatched, ambiguous };
}

/**
 * The learner-only file one model ships: no engineering block, no id patterns, no part numbers. A model's own wording for a part (a
 * different `sits` line, its own material basis, a system of its own, a review state of its own) travels in `overrides`, only for the parts
 * that have any; a model with none has no `overrides` key at all.
 */
export function projectModel(loaded, modelId, partIds = undefined) {
  const instanceDoc = instanceDocFor(loaded, modelId);
  const ids = partIds ?? modelPartIds(instanceDoc);
  const { rows, unmatched, ambiguous } = mapParts(instanceDoc, ids);
  if (unmatched.length || ambiguous.length) {
    throw new Error(`parts without exactly one definition: ${unmatched.length} unmatched, ${ambiguous.length} ambiguous`);
  }
  const byId = new Map(loaded.definitions.map((d) => [d.id, d]));
  const used = new Set(Object.values(rows).map((hit) => hit.definition));
  const parts = {};
  const overrides = {};
  for (const [pid, hit] of Object.entries(rows)) {
    parts[pid] = [hit.definition, hit.label];
    const definition = byId.get(hit.definition);
    const extra = {};
    if (hit.row?.system && hit.row.system !== definition.student.system) extra.system = hit.row.system;
    for (const [field, claim] of Object.entries(hit.row?.claims ?? {})) extra[field] = claim;
    if (hit.row?.review && hit.row.review !== definition.review) extra.review = hit.row.review;
    if (Object.keys(extra).length) overrides[pid] = extra;
  }
  const titles = Object.fromEntries(loaded.definitions.map((d) => [d.id, d.student.title.text]));
  const definitions = {};
  for (const d of loaded.definitions) {
    if (!used.has(d.id)) continue;
    const s = d.student;
    definitions[d.id] = {
      family: d.family,
      review: d.review,
      title: s.title,
      context: s.context ?? '',
      aliases: s.aliases,
      system: s.system,
      function: s.function,
      madeOf: s.madeOf,
      sits: s.sits,
      worksWith: { ...s.worksWith, titles: s.worksWith.ids.map((id) => titles[id]) },
      lookFor: s.lookFor,
      catalogue: s.catalogue ? { description: s.catalogue.description, note: s.catalogue.note } : null,
      lessons: s.lessons,
    };
  }
  // Where every part of a kind says the same thing of its own, that is the kind's line in this model: the file then ships only what a learner
  // can read (the shared line, which may speak of another model, is not carried as dead data), and the parts need no override.
  for (const id of used) {
    const members = Object.entries(rows).filter(([, hit]) => hit.definition === id).map(([pid]) => pid);
    for (const field of ['function', 'madeOf', 'sits']) {
      const own = members.map((pid) => overrides[pid]?.[field]);
      if (own.some((claim) => !claim) || new Set(own.map((claim) => JSON.stringify(claim))).size !== 1) continue;
      definitions[id][field] = own[0];
      for (const pid of members) {
        delete overrides[pid][field];
        if (Object.keys(overrides[pid]).length === 0) delete overrides[pid];
      }
    }
  }
  const allReviewed = [...used].every((id) => byId.get(id).review === 'reviewed') && Object.values(overrides).every((extra) => !extra.review || extra.review === 'reviewed');
  const projection = {
    schema: instanceDoc.projection.schema,
    model: instanceDoc.model,
    state: allReviewed ? 'reviewed' : 'draft',
    systems: loaded.store.systems,
    statuses: loaded.store.rules.statuses,
    definitions,
    // part id -> [definition id, what tells it from the others of its kind]
    parts,
  };
  if (Object.keys(overrides).length) projection.overrides = overrides;
  return projection;
}

/** Walk any JSON value and return every string in it (for scanning shipped data). */
export function* allStrings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* allStrings(v);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* allStrings(v);
}

export function serialise(projection) {
  return `${JSON.stringify(projection, null, 1)}\n`;
}

export const outPathFor = (instanceDoc) => path.join(ROOT, instanceDoc.projection.file);
export const fileExists = existsSync;
