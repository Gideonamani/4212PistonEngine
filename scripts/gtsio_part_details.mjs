// Learner-facing part details for the R10 (GTSIO-520-H) Explore card.
//
// data/gtsio520-part-definitions.json is the single source: one definition per kind of part, each with a
// 'student' block (what a learner may see once the text is reviewed) and an 'engineering' block (catalogue
// cross-check; never shipped). This module loads it, maps contract part ids to definitions, validates the
// text rules and projects the student-only view that ships in web/gtsio520-r10-parts.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFINITIONS_PATH = path.join(ROOT, 'data/gtsio520-part-definitions.json');
export const CONTRACT_PATH = path.join(ROOT, 'web/gtsio520-r10-contract.json');
export const PARTS_OUT_PATH = path.join(ROOT, 'web/gtsio520-r10-parts.json');
export const R10_MODEL_ID = 'gtsio520-h-r10-mechanism-study';

export const STATUSES = ['specified', 'derived', 'inferred', 'illustrative'];
export const SYSTEMS = ['structure', 'power', 'gas', 'ignition', 'lubrication', 'output', 'accessories'];
export const ALIGNMENT = ['confirmed', 'gtsio_only', 'io520_only', 'mismatch', 'not_found'];
export const REVIEW_STATES = ['draft', 'reviewed'];

// Word limits for the student text (the function line is the one learners read first).
export const LIMITS = { title: 4, function: 22, madeOf: 8, sits: 28, lookFor: 22, context: 3 };

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

export function loadDefinitions(file = DEFINITIONS_PATH) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadContractPartIds(file = CONTRACT_PATH) {
  const contract = JSON.parse(readFileSync(file, 'utf8'));
  return contract.parts.map((p) => p.id);
}

const words = (text) => (String(text).match(/\S+/g) ?? []).length;

/** Anchored matchers for each definition's id patterns (the data stores JS named-group syntax). */
export function compileMatchers(doc) {
  return doc.definitions.map((d) => ({ id: d.id, regs: d.match.map((p) => new RegExp(`^(?:${p})$`)) }));
}

/** Map every part id to exactly one definition id; report ids with none or several. `groups` keeps each id's named pattern groups (cylinder, side...). */
export function mapParts(doc, partIds) {
  const matchers = compileMatchers(doc);
  const map = {};
  const groups = {};
  const unmatched = [];
  const ambiguous = [];
  for (const pid of partIds) {
    const hits = [];
    for (const m of matchers) {
      for (const r of m.regs) {
        const found = r.exec(pid);
        if (found) {
          hits.push({ id: m.id, groups: found.groups ?? {} });
          break;
        }
      }
    }
    if (hits.length === 0) unmatched.push(pid);
    else if (hits.length > 1) ambiguous.push({ part: pid, definitions: hits.map((h) => h.id) });
    else {
      map[pid] = hits[0].id;
      groups[pid] = hits[0].groups;
    }
  }
  return { map, groups, unmatched, ambiguous };
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

function checkClaim(errors, defId, name, claim, maxWords) {
  const where = `${defId}.${name}`;
  if (!claim || typeof claim.text !== 'string' || !claim.text.trim()) {
    errors.push(`${where}: missing text`);
    return;
  }
  if (!STATUSES.includes(claim.status)) errors.push(`${where}: bad status ${claim.status}`);
  const needsSource = claim.status === 'specified' || claim.status === 'derived';
  if (needsSource && !claim.source) errors.push(`${where}: ${claim.status} claim without a source`);
  if (!needsSource && !claim.basis) errors.push(`${where}: ${claim.status} claim without a basis`);
  if (claim.source && claim.basis) errors.push(`${where}: has both a source and a basis`);
  if (maxWords && words(claim.text) > maxWords) errors.push(`${where}: ${words(claim.text)} words, limit ${maxWords}`);
  for (const re of BANNED_STUDENT_PATTERNS) {
    if (re.test(claim.text)) errors.push(`${where}: banned pattern ${re} in "${claim.text}"`);
  }
}

/** Every rule the definitions file must meet. Returns a list of error strings (empty when clean). */
export function validateDefinitions(doc) {
  const errors = [];
  if (doc.schema !== 'gtsio520-part-definitions/1') errors.push(`unexpected schema ${doc.schema}`);
  if (doc.model !== R10_MODEL_ID) errors.push(`unexpected model ${doc.model}`);
  const ids = new Set();
  const titleCounts = new Map();
  for (const d of doc.definitions) {
    if (ids.has(d.id)) errors.push(`${d.id}: duplicate id`);
    ids.add(d.id);
    const title = d.student?.title?.text;
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }
  for (const d of doc.definitions) {
    const s = d.student;
    if (!s) {
      errors.push(`${d.id}: no student block`);
      continue;
    }
    if (!REVIEW_STATES.includes(d.review)) errors.push(`${d.id}: bad review state ${d.review}`);
    if (!SYSTEMS.includes(s.system)) errors.push(`${d.id}: bad system ${s.system}`);
    checkClaim(errors, d.id, 'title', s.title, LIMITS.title);
    checkClaim(errors, d.id, 'function', s.function, LIMITS.function);
    checkClaim(errors, d.id, 'madeOf', s.madeOf, LIMITS.madeOf);
    checkClaim(errors, d.id, 'sits', s.sits, LIMITS.sits);
    checkClaim(errors, d.id, 'lookFor', s.lookFor, LIMITS.lookFor);
    if (s.lookFor && s.lookFor.status !== 'illustrative') errors.push(`${d.id}.lookFor: must be illustrative`);
    // A catalogue noun shared by several definitions ("Screw") needs a qualifier to tell them apart in the Parts list; a unique one must not carry one.
    const shared = titleCounts.get(s.title?.text) > 1;
    if (shared && !s.context) errors.push(`${d.id}: title "${s.title.text}" is shared, so it needs a context`);
    if (!shared && s.context) errors.push(`${d.id}: has a context but its title is unique`);
    if (s.context) {
      if (words(s.context) > LIMITS.context) errors.push(`${d.id}.context: ${words(s.context)} words, limit ${LIMITS.context}`);
      for (const re of BANNED_STUDENT_PATTERNS) if (re.test(s.context)) errors.push(`${d.id}.context: banned pattern ${re} in "${s.context}"`);
    }
    if (!s.worksWith || !Array.isArray(s.worksWith.ids) || s.worksWith.ids.length < 1 || s.worksWith.ids.length > 6) {
      errors.push(`${d.id}.worksWith: needs one to six ids`);
    } else {
      for (const w of s.worksWith.ids) {
        if (!ids.has(w)) errors.push(`${d.id}.worksWith: unknown definition ${w}`);
        if (w === d.id) errors.push(`${d.id}.worksWith: lists itself`);
      }
      if (!STATUSES.includes(s.worksWith.status)) errors.push(`${d.id}.worksWith: bad status`);
    }
    for (const a of s.aliases ?? []) {
      for (const re of BANNED_STUDENT_PATTERNS) if (re.test(a)) errors.push(`${d.id}.aliases: banned pattern ${re} in "${a}"`);
    }
    if (s.catalogue) {
      for (const re of PART_NUMBER_PATTERNS) {
        if (re.test(s.catalogue.description)) errors.push(`${d.id}.catalogue: banned pattern ${re} in "${s.catalogue.description}"`);
      }
      if (!s.catalogue.note) errors.push(`${d.id}.catalogue: missing provenance note`);
    }
    const e = d.engineering;
    if (!e) errors.push(`${d.id}: no engineering block`);
    else {
      if (!ALIGNMENT.includes(e.alignment?.result)) errors.push(`${d.id}: bad alignment ${e.alignment?.result}`);
      if (!e.alignment?.note) errors.push(`${d.id}: alignment without a note`);
      const refs = (e.ipcIo520?.length ?? 0) + (e.gtsioManual?.length ?? 0) + (e.gtsioOnlineIpcH1b?.length ?? 0);
      if (refs === 0 && e.alignment?.result !== 'not_found') errors.push(`${d.id}: no references but alignment is ${e.alignment?.result}`);
      if (e.alignment?.result === 'not_found' && refs > 0) errors.push(`${d.id}: not_found but has references`);
    }
    if (!Array.isArray(d.match) || d.match.length === 0) errors.push(`${d.id}: no id patterns`);
    else {
      for (const p of d.match) {
        try {
          new RegExp(`^(?:${p})$`);
        } catch (err) {
          errors.push(`${d.id}: bad pattern ${p}: ${err.message}`);
        }
      }
    }
  }
  return errors;
}

/** The learner-only view: no engineering block, no id patterns, no part numbers. */
export function studentProjection(doc, partIds) {
  const { map, groups, unmatched, ambiguous } = mapParts(doc, partIds);
  if (unmatched.length || ambiguous.length) {
    throw new Error(`parts without exactly one definition: ${unmatched.length} unmatched, ${ambiguous.length} ambiguous`);
  }
  const wordsOf = Object.fromEntries(doc.definitions.map((d) => [d.id, d.instanceWords ?? {}]));
  const parts = {};
  for (const [pid, defId] of Object.entries(map)) parts[pid] = [defId, instanceLabel(groups[pid], wordsOf[defId])];
  const titles = Object.fromEntries(doc.definitions.map((d) => [d.id, d.student.title.text]));
  const definitions = {};
  for (const d of doc.definitions) {
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
  return {
    schema: 'gtsio520-r10-parts/1',
    model: doc.model,
    state: doc.state,
    systems: doc.systems,
    statuses: doc.rules.statuses,
    definitions,
    // part id -> [definition id, what tells it from the others of its kind]
    parts,
  };
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
