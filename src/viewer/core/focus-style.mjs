// How a lesson step draws attention to some parts of a model. Pure, so the rules are tested without a browser; each adapter turns the
// "look" it is given into its own materials.
//
// The three modes, all of which keep the spotlit parts as they normally look unless noted:
//   highlight  the spotlit parts are coloured, everything else turns a plain pale grey
//   xray       the spotlit parts stay solid, everything else becomes a faint see-through grey (the original behaviour)
//   isolate    the spotlit parts stay, everything else is hidden

/** @typedef {'highlight' | 'xray' | 'isolate'} FocusMode */
/** @typedef {'plain' | 'focus' | 'context'} PartRole  plain: no spotlight is active; focus: a spotlit part; context: any other part */
/** @typedef {'normal' | 'highlight' | 'ghost' | 'pale'} PartLook */

export const FOCUS_MODES = Object.freeze(['highlight', 'xray', 'isolate']);

/** The mode a step gets when it does not choose one: what spotlighting always did. */
export const DEFAULT_FOCUS_MODE = 'xray';

export const FOCUS_MODE_LABELS = Object.freeze({ highlight: 'Highlight', xray: 'X-ray', isolate: 'Isolate' });

/** One line each, for the student-facing switch. */
export const FOCUS_MODE_HINTS = Object.freeze({
  highlight: 'Colours the part and turns the rest pale grey',
  xray: 'Keeps the part solid and shows the rest as a faint ghost',
  isolate: 'Shows the part on its own',
});

// How the looks are drawn. Opacity is a little stronger than the 0.12 the ghost used to have, which all but vanished on a phone.
export const XRAY_OPACITY = 0.18;
export const XRAY_COLOR = 0x9cbdcf;
export const PALE_COLOR = 0xd7e0e6;
export const HIGHLIGHT_COLOR = 0x39e4c4;
export const HIGHLIGHT_EMISSIVE = 0x087567;

/** @param {unknown} value @returns {value is FocusMode} */
export const isFocusMode = (value) => FOCUS_MODES.includes(/** @type {never} */ (value));

/** @param {unknown} value @returns {FocusMode} */
export const focusModeOrDefault = (value) => (isFocusMode(value) ? value : DEFAULT_FOCUS_MODE);

/**
 * The role a part plays: with no spotlight every part is plain; with one, a part is either in it or around it.
 * @param {boolean} spotlightActive
 * @param {boolean} inSpotlight
 * @returns {PartRole}
 */
export const partRole = (spotlightActive, inSpotlight) => (!spotlightActive ? 'plain' : inSpotlight ? 'focus' : 'context');

/**
 * How one part is drawn: whether it shows at all, and which look it takes.
 * @param {FocusMode} mode
 * @param {PartRole} role
 * @returns {{ visible: boolean, look: PartLook }}
 */
export function partLook(mode, role) {
  if (role === 'plain') return { visible: true, look: 'normal' };
  if (role === 'focus') return { visible: true, look: mode === 'highlight' ? 'highlight' : 'normal' };
  if (mode === 'isolate') return { visible: false, look: 'normal' };
  return { visible: true, look: mode === 'highlight' ? 'pale' : 'ghost' };
}
