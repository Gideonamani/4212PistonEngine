// How a Check question is answered and marked, for every question type the screen can show. Pure, so the rules are tested without a browser.
//
//   multiple-choice  the answer is the index of the chosen option
//   ordering         the answer is the list of items in the order the learner has put them
//   matching         the answer lists, for each left-hand term in pack order, the right-hand text the learner chose ('' while unchosen)
//   numeric          the answer is the text the learner typed; it is read as a number and marked within the question's tolerance

/** @typedef {import('../../types/engine').QuizQuestion} QuizQuestion */

/** The question types the Check screen can show. A type the pack schema allows but is not listed here cannot ship yet. */
export const ANSWERABLE_TYPES = Object.freeze(['multiple-choice', 'ordering', 'matching', 'numeric']);

/**
 * A copy of `items` in random order, and never the order they came in (a shuffle that came out unchanged would hand over the answer).
 * @param {string[]} items
 * @param {() => number} [random]
 * @returns {string[]}
 */
export function shuffled(items, random = Math.random) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  if (next.length > 1 && next.every((item, index) => item === items[index])) [next[0], next[1]] = [next[1], next[0]];
  return next;
}

// An option that only makes sense in the last place ("All of the above", "None of these") is never moved.
const ANCHORED_LAST = /^(all|none) of (the above|these|them)\b/i;

/**
 * The order a multiple-choice question's options are shown in: a random order of their indexes, with an option such as "All of the
 * above" kept last. The pack order is not used, so the right answer cannot be found by knowing where authors tend to put it.
 * @param {{ options: string[] }} question
 * @param {() => number} [random]
 * @returns {number[]}
 */
export function optionOrder(question, random = Math.random) {
  const indexes = question.options.map((_, index) => index);
  const movable = indexes.filter((index) => !ANCHORED_LAST.test(question.options[index].trim()));
  const anchored = indexes.filter((index) => ANCHORED_LAST.test(question.options[index].trim()));
  for (let at = movable.length - 1; at > 0; at -= 1) {
    const swap = Math.floor(random() * (at + 1));
    [movable[at], movable[swap]] = [movable[swap], movable[at]];
  }
  return [...movable, ...anchored];
}

/**
 * The answer a question starts with, before the learner has touched it.
 * @param {QuizQuestion} question
 * @param {() => number} [random]
 * @returns {string | string[] | undefined}
 */
export function initialAnswer(question, random = Math.random) {
  if (question.type === 'ordering') return shuffled(question.items, random);
  if (question.type === 'matching') return question.pairs.map(() => '');
  if (question.type === 'numeric') return '';
  return undefined;
}

/**
 * Reads what a learner typed as a number, or null when it is not one. Accepts a leading minus (also the typographic one), spaces, and
 * commas used as thousands separators ("33,000"); a comma anywhere else is not read as a decimal point, so "1,5" is not a number here.
 * @param {unknown} text
 * @returns {number | null}
 */
export function parseNumber(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/−/g, '-').replace(/\s+/g, '');
  if (!cleaned) return null;
  const plain = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(plain)) return null;
  return Number(plain);
}

/**
 * Whether the answer is complete enough to verify.
 * @param {QuizQuestion} question
 * @param {unknown} answer
 * @returns {boolean}
 */
export function isAnswered(question, answer) {
  switch (question.type) {
    case 'ordering': return Array.isArray(answer) && answer.length === question.items.length;
    case 'matching': return Array.isArray(answer) && answer.length === question.pairs.length && answer.every((chosen) => Boolean(chosen));
    case 'numeric': return parseNumber(answer) !== null;
    default: return typeof answer === 'number';
  }
}

/** Whether a numeric answer is within the question's tolerance of the right value (a hair of slack for floating-point arithmetic). */
export function withinTolerance(value, correctValue, tolerance = 0) {
  return Math.abs(value - correctValue) <= tolerance + 1e-9 * Math.max(1, Math.abs(correctValue));
}

/**
 * @param {QuizQuestion} question
 * @param {unknown} answer
 * @returns {boolean}
 */
export function isCorrect(question, answer) {
  switch (question.type) {
    case 'ordering': return Array.isArray(answer) && answer.length === question.items.length && answer.every((item, index) => item === question.items[index]);
    case 'matching': return Array.isArray(answer) && question.pairs.every((pair, index) => answer[index] === pair.right);
    case 'numeric': {
      const value = parseNumber(answer);
      return value !== null && withinTolerance(value, question.correctValue, question.tolerance);
    }
    default: return answer === question.correctIndex;
  }
}

/**
 * For matching: whether each left-hand term was paired correctly, in pack order.
 * @param {Extract<QuizQuestion, { type: 'matching' }>} question
 * @param {unknown} answer
 * @returns {boolean[]}
 */
export function matchingResults(question, answer) {
  return question.pairs.map((pair, index) => Array.isArray(answer) && answer[index] === pair.right);
}

/**
 * A number as written in an answer: no trailing zeros, thousands separated, so "33000" shows as "33,000".
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value);
}

/** The right value of a numeric question with its unit, and the tolerance when the marking allows one: "170 hp" or "78.5 cu in (accepted within ±0.5 cu in)". */
/** @param {Extract<QuizQuestion, { type: 'numeric' }>} question @returns {string} */
export function describeNumericAnswer(question) {
  const value = `${formatNumber(question.correctValue)} ${question.unit}`;
  return question.tolerance ? `${value} (accepted within ±${formatNumber(question.tolerance)} ${question.unit})` : value;
}

/**
 * The right-hand options of a matching question in a fixed, neutral order (alphabetical), so their position never hints at the pairing.
 * @param {Extract<QuizQuestion, { type: 'matching' }>} question
 * @returns {string[]}
 */
export function matchingOptions(question) {
  return question.pairs.map((pair) => pair.right).sort((a, b) => a.localeCompare(b, 'en'));
}
