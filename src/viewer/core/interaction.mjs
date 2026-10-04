// How a learner moves a 3D model, as rules and wording. Pure, so they are tested without a browser.
//
// Inside a lesson the page itself scrolls, so a mouse wheel turned over the viewer has to scroll the page, not zoom: otherwise the page
// cannot be scrolled whenever the pointer happens to rest on the model. Zooming with the wheel then needs Ctrl or Cmd, which is also how a
// trackpad pinch arrives (as a wheel event with ctrlKey set), so pinching on a laptop still zooms. Explore owns the whole screen and
// keeps plain wheel zoom.

/** 'always': the wheel zooms. 'modifier': the wheel zooms only while Ctrl or Cmd is held, otherwise the page scrolls. */
/** @typedef {'always' | 'modifier'} WheelZoom */

/** The short note shown over the model when a wheel turn was left to the page. */
export const WHEEL_ZOOM_HINT = 'Hold Ctrl (⌘ on Mac) and scroll to zoom';

/**
 * What a wheel turn over the viewer should do.
 * @param {{ ctrlKey?: boolean, metaKey?: boolean }} event
 * @param {WheelZoom} wheelZoom
 * @returns {'zoom' | 'scroll'}
 */
export function wheelDecision(event, wheelZoom) {
  return wheelZoom === 'always' || event.ctrlKey || event.metaKey ? 'zoom' : 'scroll';
}

/**
 * The one-line "how do I move this" under or over a viewer, for the tool that is on and the way the learner is holding the device.
 * @param {{ mode: 'orbit' | 'pan', touch: boolean, wheelZoom: WheelZoom }} options
 */
export function viewerHint({ mode, touch, wheelZoom }) {
  if (mode === 'pan') return touch ? 'Drag to pan · pinch to zoom' : wheelZoom === 'always' ? 'Drag to pan · scroll to zoom' : 'Drag to pan · Ctrl + scroll to zoom';
  if (touch) return 'Drag to rotate · pinch to zoom · two fingers to pan';
  return wheelZoom === 'always' ? 'Drag to rotate · scroll to zoom · right-drag to pan' : 'Drag to rotate · Ctrl + scroll to zoom · right-drag to pan';
}
