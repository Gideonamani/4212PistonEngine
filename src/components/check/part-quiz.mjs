// The 3D part quiz: tap-the-part questions made from what a model's own data says about its parts, so a new engine has quizzes the moment
// it has parts to tap, with no question written for it. Pure, so the rules are tested without a browser; src/components/check/partFacts.ts
// turns a loaded model into the facts these functions read, and PartQuizView shows the questions.
//
// Three kinds of question, each offered only when the data can support it:
//   name     "Tap a connecting rod."               needs only a name for each part
//   job      "Tap the part that carries ..."       needs what the part does, written without its name (the learner part details)
//   system   "Tap any part that belongs to ..."    needs the system each part belongs to
// A question is marked by the tap's component, so it accepts every part that answers it: all the parts of one kind (six pistons, any of
// them), all the parts that do the same job, or every part of a system.

/** @typedef {import('../../types/engine').ModelClickQuestion} ModelClickQuestion */

/**
 * What the data says about one part. Only `id` and `name` are needed; the rest lets more kinds of question be asked.
 * @typedef {object} PartFact
 * @property {string} id            the component id, which is what a tap answers with
 * @property {string} name          what the learner calls it: "Connecting rod"
 * @property {string} [qualifier]   where it is used, when the name alone does not say: "camshaft gear"
 * @property {string} [does]        what it does, as a clause that begins with a verb: "Carries the piston's push to the crankshaft."
 * @property {string} [lookFor]     what to look for on the model
 * @property {string} [detail]      a plain description, for the explanation when nothing better is known
 * @property {{ id: string, label: string, question?: string }} [system]  the system the part belongs to
 * @property {number} [size]        the diagonal of the part's box as a fraction of the model's, when the geometry was measured
 * @property {boolean} [buried]     the part sits inside another part's box, so it has to be uncovered to be tapped
 */

/** @typedef {'name' | 'job' | 'system'} QuestionTemplate */

/** How many questions a round holds. */
export const ROUND_SIZE = 10;
/** A part smaller than this share of the model's diagonal is too small to be a fair thing to tap. */
export const MIN_PART_SIZE = 0.035;
/** More parts of one kind than this means hardware (a screw on every cover), not something to ask about. */
export const MAX_KIND_COUNT = 24;
/** A system that holds more than this share of the parts says nothing when it is the answer. */
export const MAX_SYSTEM_SHARE = 0.6;
/** The share of a round that is meant to need uncovering, when the model has enough parts that do. */
export const BURIED_SHARE = 0.35;
/** The fewest questions worth calling a quiz. A model that cannot make this many has no 3D quiz. */
export const MIN_QUESTIONS = 3;

// Fasteners and fittings that every engine has by the dozen. They are real parts, but "tap the washer" teaches nothing a name list would not.
const HARDWARE = /\b(screw|nut|washer|stud|rivet|cotter|dowel|o-ring|gasket|shim|lock ?wire|safety wire|circlip)s?\b/i;

// ---- small text helpers ----

/** The text with its first letter lower-cased, unless the first word is an acronym, a code or a name written with capitals ("IO-520"). */
export function lowerFirst(text) {
  const word = text.split(/\s+/)[0] ?? '';
  return /[A-Z0-9]{2}/.test(word) || /\d/.test(word) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

const article = (text, many) => (many ? (/^[aeiou]/i.test(text) ? 'an' : 'a') : 'the');

/** The first sentences of a text, at most `max` characters, with a trailing "Source: ..." citation cut off. */
export function leadSentences(text, sentences = 2, max = 280) {
  const clean = (text || '').replace(/\s*Source:.*$/is, '').replace(/\s+/g, ' ').trim();
  const parts = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  let out = '';
  for (const part of parts.slice(0, sentences)) {
    if (out && (out + part).length > max) break;
    out += part;
  }
  return (out || clean).trim().slice(0, max).trim();
}

const ensureStop = (text) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- random numbers ----

/**
 * A seeded random number generator, so a round can be made again from its seed and tests see the same round every time.
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

// ---- the geometry rules ----

/**
 * The ids of the parts that sit inside another part's box, so they cannot be seen from outside until the parts around them are hidden.
 * The rule is the one src/viewer/core/spotlight-enclosure.mjs uses for Highlight: boxes, not what the camera sees, erring towards
 * "inside". Written without allocation because a whole engine has over a thousand parts.
 * @param {{ id: string, min: number[], max: number[] }[]} boxes
 * @param {number} [slackShare]  how far a part may poke out of the box around it, as a share of that box's longest side
 * @returns {Set<string>}
 */
export function buriedIds(boxes, slackShare = 0.005) {
  const volumes = boxes.map((box) => Math.max(0, box.max[0] - box.min[0]) * Math.max(0, box.max[1] - box.min[1]) * Math.max(0, box.max[2] - box.min[2]));
  const slacks = boxes.map((box) => slackShare * Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]));
  const buried = new Set();
  for (let inner = 0; inner < boxes.length; inner += 1) {
    const a = boxes[inner];
    for (let outer = 0; outer < boxes.length; outer += 1) {
      if (outer === inner || volumes[outer] <= volumes[inner]) continue;
      const b = boxes[outer];
      const slack = slacks[outer];
      if (a.min[0] >= b.min[0] - slack && a.max[0] <= b.max[0] + slack
        && a.min[1] >= b.min[1] - slack && a.max[1] <= b.max[1] + slack
        && a.min[2] >= b.min[2] - slack && a.max[2] <= b.max[2] + slack) { buried.add(a.id); break; }
    }
  }
  return buried;
}

/**
 * Each part's size as a share of the whole model's diagonal.
 * @param {{ id: string, min: number[], max: number[] }[]} boxes
 * @returns {Map<string, number>}
 */
export function partSizes(boxes) {
  if (!boxes.length) return new Map();
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) for (let axis = 0; axis < 3; axis += 1) { low[axis] = Math.min(low[axis], box.min[axis]); high[axis] = Math.max(high[axis], box.max[axis]); }
  const whole = Math.hypot(high[0] - low[0], high[1] - low[1], high[2] - low[2]) || 1;
  return new Map(boxes.map((box) => [box.id, Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) / whole]));
}

// ---- grouping the facts ----

/** What makes two parts the same kind: their names, ignoring which-one numbers (see cleanName) and capitals. */
export const kindOf = (fact) => `${cleanName(fact.name).toLowerCase()}${fact.qualifier ? `|${fact.qualifier.toLowerCase()}` : ''}`;

/**
 * A part's name as a question can use it. A number that says which of several ("Piston 5 ring", "Mounting bolt 3") is dropped, because the
 * learner has no way to tell which is which and every one of them is the same kind of part; "Cylinder 4 · Barrel" reads as "Cylinder (barrel)".
 * A number that is part of a name ("IO-520", "6-cylinder") stays.
 */
export function cleanName(name) {
  let text = name.replace(/\s+/g, ' ').trim();
  const dotted = text.match(/^(.*?) · (.*)$/);
  if (dotted) text = `${dotted[1]} (${lowerFirst(dotted[2])})`;
  return text
    .replace(/(^|[\s(])\d+(?=$|[\s),.:;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/** The part's name, with where it is used when the name alone does not say: "Gear (camshaft)", "Connecting rod". */
export const fullName = (fact) => {
  const name = cleanName(fact.name);
  return fact.qualifier && !name.toLowerCase().includes(fact.qualifier.toLowerCase()) ? `${name} (${fact.qualifier})` : name;
};

/** The name as it reads in the middle of a sentence: "gear (camshaft)", "connecting rod". */
const spoken = (fact) => lowerFirst(fullName(fact));

/** Whether a part is a fair thing to ask about: named plainly, big enough to tap, not hardware. */
export function isAskable(fact) {
  const name = cleanName(fact.name);
  if (name.length < 3 || name.length > 60 || /\s\/\s/.test(name) || HARDWARE.test(name)) return false;
  return fact.size === undefined || fact.size >= MIN_PART_SIZE;
}

/**
 * @typedef {object} Kind
 * @property {string} key
 * @property {PartFact} lead     the part whose wording stands for the kind
 * @property {string[]} ids      every part of the kind, since a tap on any of them is right
 * @property {boolean} buried    every part of the kind has to be uncovered
 */

/** @param {PartFact[]} facts @returns {Kind[]} */
function kindsOf(facts) {
  /** @type {Map<string, Kind>} */
  const kinds = new Map();
  for (const fact of facts) {
    const key = kindOf(fact);
    const kind = kinds.get(key);
    if (kind) { kind.ids.push(fact.id); kind.buried &&= Boolean(fact.buried); } else kinds.set(key, { key, lead: fact, ids: [fact.id], buried: Boolean(fact.buried) });
  }
  return [...kinds.values()];
}

// ---- the questions ----

const UNCOVER_HINT = 'This part is inside the engine. Hide the parts around it to uncover it, then tap it.';

function nameQuestion(modelId, kind, system) {
  const lead = kind.lead;
  const said = spoken(lead);
  const many = kind.ids.length > 1;
  const text = ensureStop(`Tap ${article(said, many)} ${said}`);
  const sentences = [lead.does ? ensureStop(lead.does) : leadSentences(lead.detail)].filter(Boolean);
  if (lead.lookFor) sentences.push(ensureStop(lead.lookFor));
  const what = fullName(lead);
  return {
    id: `${modelId}:name:${slug(kind.key)}`,
    type: 'model-click', modelId, question: text, ...(kind.buried ? { hint: UNCOVER_HINT } : {}),
    explanation: [`${what}${system ? ` · ${system.label}` : ''}.`, ...sentences].join(' '),
    correctNodeId: kind.ids[0], ...(kind.ids.length > 1 ? { alsoAccept: kind.ids.slice(1) } : {}),
    generated: { template: 'name', answer: what, buried: kind.buried },
  };
}

// A job written as a noun phrase ("The outer barrel of the lifter ...") cannot follow "part that", so it is quoted instead.
const NOUN_LED = /^(the|a|an|this|that|these|those|each|every|its|their|one|two|three|four|six|nine|\d)\b/i;

function jobQuestion(modelId, kind, ids) {
  const lead = kind.lead;
  const which = ids.length > 1 ? 'a' : 'the';
  const does = lead.does.trim().replace(/\.$/, '');
  const text = NOUN_LED.test(does) ? `Tap ${which} part described as “${does}”.` : ensureStop(`Tap ${which} part that ${lowerFirst(does)}`);
  const what = fullName(lead);
  const sentences = [ensureStop(lead.does)];
  if (lead.lookFor) sentences.push(ensureStop(lead.lookFor));
  return {
    id: `${modelId}:job:${slug(kind.key)}`,
    type: 'model-click', modelId, question: text, ...(kind.buried ? { hint: UNCOVER_HINT } : {}),
    explanation: [`That is the ${lowerFirst(what)}.`, ...sentences].join(' '),
    correctNodeId: ids[0], ...(ids.length > 1 ? { alsoAccept: ids.slice(1) } : {}),
    generated: { template: 'job', answer: what, buried: kind.buried },
  };
}

function systemQuestion(modelId, system, members, askable) {
  const names = [...new Set(askable.map((fact) => spoken(fact)))].slice(0, 5);
  return {
    id: `${modelId}:system:${slug(system.id)}`,
    type: 'model-click', modelId,
    question: `Tap any part that belongs to “${system.label}”.`,
    ...(system.question ? { hint: system.question } : {}),
    explanation: `${system.label}${system.question ? ` answers: ${system.question}` : '.'} Its parts include the ${names.join(', the ')}.`,
    correctNodeId: members[0], ...(members.length > 1 ? { alsoAccept: members.slice(1) } : {}),
    generated: { template: 'system', answer: system.label, buried: false },
  };
}

/**
 * What a model can be asked about, before any round is drawn: how many questions of each kind its data supports.
 * @param {PartFact[]} facts
 */
export function quizPool(facts) {
  const askable = facts.filter(isAskable);
  const kinds = kindsOf(askable).filter((kind) => kind.ids.length <= MAX_KIND_COUNT);

  // A job is a clause shared by every kind that has the same words, so a tap on any of them is right.
  /** @type {Map<string, { kind: Kind, ids: string[] }>} */
  const jobs = new Map();
  for (const kind of kinds) {
    const does = kind.lead.does?.trim();
    if (!does || does.toLowerCase().includes(cleanName(kind.lead.name).toLowerCase())) continue;
    const key = does.toLowerCase();
    const known = jobs.get(key);
    if (known) { known.ids.push(...kind.ids); known.kind = { ...known.kind, buried: known.kind.buried && kind.buried }; } else jobs.set(key, { kind, ids: [...kind.ids] });
  }

  /** @type {Map<string, { system: NonNullable<PartFact['system']>, members: string[], askable: PartFact[] }>} */
  const systems = new Map();
  const everyone = facts.length || 1;
  for (const fact of facts) {
    if (!fact.system) continue;
    const entry = systems.get(fact.system.id) ?? { system: fact.system, members: [], askable: [] };
    entry.members.push(fact.id);
    if (isAskable(fact)) entry.askable.push(fact);
    systems.set(fact.system.id, entry);
  }
  // A system named by a number ("Cylinder 5") is one of several alike, and the learner cannot tell which is which.
  const usableSystems = [...systems.values()].filter((entry) => entry.askable.length >= 3 && entry.members.length / everyone <= MAX_SYSTEM_SHARE && !/(^|\s)\d+(\s|$)/.test(entry.system.label));

  return { kinds, jobs: [...jobs.values()], systems: usableSystems };
}

/**
 * One round of questions for a model: up to `count`, made from its part facts. Asks about each kind of part at most once, mixes the
 * kinds of question the data supports, and keeps about a third of the round for parts that must be uncovered when the model has enough.
 * @param {string} modelId
 * @param {PartFact[]} facts
 * @param {{ count?: number, random?: () => number }} [options]
 * @returns {ModelClickQuestion[]}
 */
export function buildPartQuiz(modelId, facts, { count = ROUND_SIZE, random = Math.random } = {}) {
  const pool = quizPool(facts);
  const systemOf = new Map(facts.map((fact) => [fact.id, fact.system]));

  // How the round is split between the kinds of question the data can ask: names carry it, jobs and systems add variety.
  const jobWanted = pool.jobs.length ? Math.round(count * 0.3) : 0;
  const systemWanted = pool.systems.length ? Math.max(1, Math.round(count * 0.2)) : 0;
  const systemsTaken = Math.min(systemWanted, pool.systems.length, Math.max(0, count - 2));
  const jobsTaken = Math.min(jobWanted, pool.jobs.length);

  const used = new Set();
  /** Takes up to `n` entries, uncovering questions first until their share is met. */
  const draw = (entries, n, isBuried, keyOf) => {
    const fresh = shuffle(entries.filter((entry) => !used.has(keyOf(entry))), random);
    const buriedFirst = Math.ceil(n * BURIED_SHARE);
    const buried = fresh.filter(isBuried).slice(0, buriedFirst);
    const rest = fresh.filter((entry) => !buried.includes(entry));
    const picked = [...buried, ...rest].slice(0, n);
    for (const entry of picked) used.add(keyOf(entry));
    return picked;
  };

  const questions = [];
  for (const job of draw(pool.jobs, jobsTaken, (job) => job.kind.buried, (job) => job.kind.key)) questions.push(jobQuestion(modelId, job.kind, job.ids));
  for (const entry of shuffle(pool.systems, random).slice(0, systemsTaken)) questions.push(systemQuestion(modelId, entry.system, entry.members, entry.askable));
  const namesWanted = Math.max(0, count - questions.length);
  // A job question already stands for its kind (`used` holds it), so the same kind is not asked again by name.
  for (const kind of draw(pool.kinds, namesWanted, (candidate) => candidate.buried, (candidate) => candidate.key)) questions.push(nameQuestion(modelId, kind, systemOf.get(kind.lead.id)));
  return shuffle(questions, random);
}

/**
 * Whether a model has enough to quiz on, and how many different questions its data can make in all (a round draws from them).
 * @param {PartFact[]} facts
 */
export function quizSupply(facts) {
  const pool = quizPool(facts);
  const total = pool.kinds.length + pool.systems.length;
  return { total, templates: [...(pool.kinds.length ? ['name'] : []), ...(pool.jobs.length ? ['job'] : []), ...(pool.systems.length ? ['system'] : [])], enough: total >= MIN_QUESTIONS };
}
