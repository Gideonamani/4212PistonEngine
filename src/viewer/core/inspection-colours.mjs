// The inspection colours of a model that has none of its own: one colour for each group of parts, so neighbouring groups read apart.
// Plain JavaScript so a Node test can pin it.
//
// Several models come out of the CAD pipeline in one finish (the GTSIO-520-H R10: 121 materials, every one a pale metal; the hydraulic tappet and
// the oil pump: pale pastel plastics), so by their own colours the parts blur together. The "Colour treatment" setting offers Inspection colours or
// the file's own (Original CAD colours); the accessory drives already had a palette for it and these models did not. A group's colour is chosen by
// the order the groups first appear in the contract, so it does not change when a part is added, and it does not carry any meaning: groups are told
// apart by it, not named by it.
//
// The twelve colours keep clear of what the spotlight uses (a teal Highlight, a periwinkle X-ray ghost on the dark stage and an indigo one on the
// light stage, src/viewer/core/focus-style.mjs), are mid-tone so they show on both stages (at least 1.7:1 against the light stage and 2.2:1 against
// the dark one), and are listed so that groups next to each other in the list look quite different. scripts/test_inspection_colours.mjs holds all of it.

export const GROUP_COLOURS = Object.freeze(['#5aa8d4', '#515960', '#e48233', '#a6344c', '#d9818f', '#7f8026', '#c656a6', '#4f9b3e', '#a65c20', '#1779e1', '#c4a11e', '#d24d45']);

const channels = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
const toLinear = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const toSrgb = (value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
const toHex = (values) => `#${values.map((value) => Math.round(Math.min(1, Math.max(0, toSrgb(value))) * 255).toString(16).padStart(2, '0')).join('')}`;

/** A colour mixed `amount` of the way to `target` (a linear 0 for black, 1 for white), mixed as light is. */
const mixed = (hex, target, amount) => toHex(channels(hex).map((value) => { const linear = toLinear(value); return linear + (target - linear) * amount; }));

/**
 * The colour for the `index`th group. Past the twelve it goes round again, darker the second time and lighter the third, so the groups of a
 * model with a great many (the R10 has 51) are still mostly told apart by it.
 * @param {number} index
 */
export function groupColour(index) {
  const base = GROUP_COLOURS[index % GROUP_COLOURS.length];
  const round = Math.floor(index / GROUP_COLOURS.length) % 3;
  return round === 1 ? mixed(base, 0, 0.45) : round === 2 ? mixed(base, 1, 0.3) : base;
}

/**
 * A colour for each group, by the order the groups are first met.
 * @param {Iterable<string>} groups  the group of each part, in the contract's order; repeats are fine
 * @returns {Map<string, string>}
 */
export function groupColourMap(groups) {
  const colours = new Map();
  for (const group of groups) if (!colours.has(group)) colours.set(group, groupColour(colours.size));
  return colours;
}
