// How a lesson step draws attention to some parts of a model. Pure, so the rules are tested without a browser; each adapter turns the
// "look" it is given into its own materials.
//
// The three modes, all of which keep the spotlit parts as they normally look unless noted:
//   highlight  the spotlit parts are coloured, everything else turns a plain pale grey
//   xray       the spotlit parts stay solid, everything else becomes a faint see-through grey (the original behaviour)
//   isolate    the spotlit parts stay, everything else is hidden
// Highlight is drawn as xray while it would hide a spotlit part that sits inside another part (see spotlight-enclosure.mjs); these rules are the
// modes as drawn, and the adapters pass them the mode that is in force.

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

// How the looks are drawn, for each theme's stage (STAGE_COLOR in src/theme/theme.mjs). An X-ray is drawn on the far side of the stage from the
// background: pale layers on the dark stage, dark layers on the light one. Several thin layers stack up wherever parts overlap, which is what
// makes the ghost read as depth, so it is judged by eye and not by the flat contrast of one layer (the old pale ghost on the light stage was
// 1.07:1 and nearly vanished).
// The ghost and the highlight must also stand apart from the models' own colours. Most parts are bare metal, pale blue-greys from #99a8b6 to
// #d7dbe1, with brass and some mid and dark greys, and a spotlit part keeps its own colour in an X-ray (it is not tinted). Where parts are
// dense the layers stack until the picture is the ghost colour itself, so the old pale blue-grey dark ghost (#9cbdcf) became the colour of
// the parts and a steel part vanished into it (#92). The ghosts are therefore blue-violet, a hue no part has: periwinkle on the dark stage,
// indigo on the light one. The indigo is kept faint (0.12): stronger it stands further from the parts but turns the picture an electric blue. The dark highlight was a bright teal at 1.2:1 against the pale grey around it, and is now a deeper teal.
// scripts/test_focus_style.mjs holds the palette to all of this against the models' dominant part colours.
// The pale grey is neutral on purpose: the viewer's tone mapping keeps a colour as it is, so a blue-grey would draw blue, and e2e/spotlight-themes.spec.ts reads
// the context of a Highlight as a light neutral grey. It is lit like any part, so on the light stage it draws as a mid grey, darker than the stage.
// `neutral` is for a picture drawn on a transparent background (a card image, see docs/card-thumbnails.md), which is then laid over either
// stage: its ghost is a mid tone, the one colour that shows on both.
export const SPOTLIGHT_PALETTE = Object.freeze({
  dark: Object.freeze({ ghostColor: 0x9e8afa, ghostOpacity: 0.2, paleColor: 0xdcdfe1, highlightColor: 0x0fa38d, highlightEmissive: 0x05473d }),
  light: Object.freeze({ ghostColor: 0x2a2190, ghostOpacity: 0.12, paleColor: 0xcdd1d4, highlightColor: 0x0d8577, highlightEmissive: 0x04463f }),
  neutral: Object.freeze({ ghostColor: 0x5f8195, ghostOpacity: 0.22, paleColor: 0xa9b8c0, highlightColor: 0x0e8a79, highlightEmissive: 0x055a4f }),
});

/** The colours for a theme ('light', 'dark' or, for a picture on no stage, 'neutral'); anything else gets the dark ones, the viewer's original look. */
export const spotlightPalette = (theme) => (theme === 'light' ? SPOTLIGHT_PALETTE.light : theme === 'neutral' ? SPOTLIGHT_PALETTE.neutral : SPOTLIGHT_PALETTE.dark);

// The dark palette under its old names, for what was written before the palette had themes.
export const XRAY_OPACITY = SPOTLIGHT_PALETTE.dark.ghostOpacity;
export const XRAY_COLOR = SPOTLIGHT_PALETTE.dark.ghostColor;
export const PALE_COLOR = SPOTLIGHT_PALETTE.dark.paleColor;
export const HIGHLIGHT_COLOR = SPOTLIGHT_PALETTE.dark.highlightColor;
export const HIGHLIGHT_EMISSIVE = SPOTLIGHT_PALETTE.dark.highlightEmissive;

/** Said under the style tiles while Highlight is being drawn as an X-ray because it would have hidden a spotlit part (see spotlight-enclosure.mjs). */
export const HIGHLIGHT_FALLBACK_NOTE = 'Some of these parts are inside others, and Highlight would hide them, so they are shown as an X-ray.';

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
