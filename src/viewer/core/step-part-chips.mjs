// The part chips under a lesson step's text: one chip for each part the step spotlights, so a learner can look at them one at a time.
// Pure, so the rules are tested without a browser; the chips themselves (src/viewer/controls/StepPartChips.tsx) only draw them.
//
//   A step that spotlights two or more parts offers a chip for each. Tapping a chip spotlights just that part; tapping it again, or the
//   next step, goes back to the step's own spotlight. A step with one part has nothing to tell apart, so it gets no chips.

/** The fewest spotlit parts that are worth a row of chips. */
export const CHIPS_MIN_PARTS = 2;

/** A row shows this many chips and then a "+N more" button, so a step with ten parts does not push its text out of sight. */
export const CHIPS_COLLAPSED_LIMIT = 6;

/**
 * The chips for a step: its spotlit parts, in the order the step names them, each with the label the model gives it. A part the model
 * does not list is left out, and so is a part named twice.
 * @param {string[] | undefined} focusParts  the step's focusParts
 * @param {{ id: string, label: string }[] | undefined} components  the loaded model's components
 * @returns {{ id: string, label: string }[]}
 */
export function stepPartChips(focusParts, components) {
  const labels = new Map((components ?? []).map((component) => [component.id, component.label]));
  const seen = new Set();
  const chips = [];
  for (const id of focusParts ?? []) {
    if (seen.has(id) || !labels.has(id)) continue;
    seen.add(id);
    chips.push({ id, label: labels.get(id) || id });
  }
  return chips;
}

/** Whether a step's chips are worth showing at all. */
export const chipsOffered = (chips) => chips.length >= CHIPS_MIN_PARTS;

/**
 * Which chips to draw: all of them when `expanded`, otherwise the first few. The chip that is selected is never hidden, because a
 * learner who has chosen a part must be able to see which one it is (and tap it again).
 * @template {{ id: string }} Chip
 * @param {Chip[]} chips
 * @param {{ expanded?: boolean, selected?: string, limit?: number }} [options]
 * @returns {{ shown: Chip[], hidden: number }}
 */
export function visibleChips(chips, { expanded = false, selected, limit = CHIPS_COLLAPSED_LIMIT } = {}) {
  if (expanded || chips.length <= limit) return { shown: chips, hidden: 0 };
  const shown = chips.filter((chip, index) => index < limit || chip.id === selected);
  return { shown, hidden: chips.length - shown.length };
}

/** The part a tap leaves chosen: the one tapped, or none if it was already the chosen one. */
export const toggleChip = (selected, id) => (selected === id ? undefined : id);

/**
 * The parts to spotlight: just the chosen one, or, with none chosen, the step's own.
 * @param {string | undefined} selected
 * @param {string[] | undefined} focusParts
 * @returns {string[]}
 */
export const spotlightFor = (selected, focusParts) => (selected ? [selected] : [...(focusParts ?? [])]);
