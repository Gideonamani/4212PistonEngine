/**
 * A tap is a single primary contact that never became a drag. Keep the active contacts
 * after a cancellation so lifting one finger of a pinch cannot start a new tap.
 * @typedef {{ pointerId: number, clientX: number, clientY: number, pointerType?: string, button?: number, isPrimary?: boolean, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean }} TapEvent
 */
export function createTapGesture() {
  const contacts = new Set();
  /** @type {{ id: number, x: number, y: number, tolerance: number } | undefined} */
  let candidate;
  /** @param {TapEvent} event */
  const move = (event) => {
    if (candidate?.id === event.pointerId && Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > candidate.tolerance) candidate = undefined;
  };
  return {
    /** @param {TapEvent} event */
    down(event) {
      contacts.add(event.pointerId);
      candidate = contacts.size === 1 && event.isPrimary !== false && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
        ? { id: event.pointerId, x: event.clientX, y: event.clientY, tolerance: event.pointerType === 'touch' ? 8 : 5 }
        : undefined;
    },
    move,
    /** @param {TapEvent} event */
    up(event) {
      move(event);
      const tapped = contacts.size === 1 && candidate?.id === event.pointerId && event.button === 0;
      contacts.delete(event.pointerId);
      candidate = undefined;
      return tapped;
    },
    /** @param {{ pointerId: number }} event */
    cancel(event) { contacts.delete(event.pointerId); candidate = undefined; },
    reset() { contacts.clear(); candidate = undefined; },
  };
}
