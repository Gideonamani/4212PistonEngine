// Where a floating panel over the model sits once the learner has moved it (Explore's part card), and the height of Explore's controls
// drawer once the learner has dragged it. Both are kept on this device as plain numbers, so these helpers stay free of the DOM.

/**
 * The top-left corner `position` moved as little as needed for a panel of `size` to lie wholly inside `bounds` (both { width, height }).
 * A panel larger than the bounds is pinned to the top-left corner.
 * @param {{ x: number, y: number }} position
 * @param {{ width: number, height: number }} size
 * @param {{ width: number, height: number }} bounds
 */
export function clampPosition(position, size, bounds) {
  const x = Math.min(Math.max(0, position.x), Math.max(0, bounds.width - size.width));
  const y = Math.min(Math.max(0, position.y), Math.max(0, bounds.height - size.height));
  return { x: Math.round(x), y: Math.round(y) };
}

/** A stored corner read back: `undefined` for nothing stored or anything that is not two finite numbers. */
export function parsePosition(text) {
  if (typeof text !== 'string') return undefined;
  try {
    const value = JSON.parse(text);
    return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? { x: value.x, y: value.y } : undefined;
  } catch {
    return undefined;
  }
}

/** The corner as it is stored. */
export const formatPosition = ({ x, y }) => JSON.stringify({ x: Math.round(x), y: Math.round(y) });

/**
 * A drawer height within its limits: never under `min`, and never so tall that the model above it keeps less than `keep` pixels of a
 * section `available` pixels tall (when the two disagree, `min` wins).
 */
export function clampHeight(height, { min, available, keep }) {
  return Math.round(Math.max(min, Math.min(height, available - keep)));
}

/** A stored height read back: `undefined` unless it is a positive finite number. */
export function parseHeight(text) {
  const value = typeof text === 'string' && text.trim() ? Number(text) : NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
