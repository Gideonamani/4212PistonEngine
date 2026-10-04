// Where a lesson step puts its 3D viewer relative to the text. Pure, so the rule is tested without a browser.
//
//   stacked  the viewer sits above the text and never takes more than 75% of the lesson's scroll area, so a finger can always land on
//            text to scroll (the canvas keeps touch-none so a drag rotates the model)
//   side     the viewer has the left column to itself, pinned while the text scrolls in the right column

/** @typedef {'stacked' | 'side'} LessonLayout */

export const LESSON_LAYOUTS = Object.freeze(['stacked', 'side']);

/** Side by side needs a wide landscape screen; a phone held upright, or a narrow window, always stacks. */
export const SIDE_BY_SIDE_QUERY = '(orientation: landscape) and (min-width: 560px)';

/**
 * The layout in force: the learner's own choice where there is room for both, otherwise stacked. With no choice yet, a landscape
 * screen starts side by side.
 * @param {{ roomForSideBySide: boolean, choice?: LessonLayout }} options
 * @returns {LessonLayout}
 */
export function effectiveLayout({ roomForSideBySide, choice }) {
  if (!roomForSideBySide) return 'stacked';
  return choice === 'stacked' ? 'stacked' : 'side';
}
