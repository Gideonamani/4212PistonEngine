// Which parts a learner has hidden to look beneath them, in the order they were hidden so Undo can bring the last ones back, and how a
// keyboard user steps from one part to the next without a list of names. Pure, so the rules are tested without a browser; each adapter
// turns "hidden" into `mesh.visible = false`.

/**
 * The hidden parts of one model. Hiding a part that is already hidden changes nothing, and a hide that changed nothing leaves nothing to undo.
 * @returns {{
 *   has: (id: string) => boolean,
 *   size: () => number,
 *   ids: () => string[],
 *   hide: (ids: string[]) => string[],
 *   undo: () => string[],
 *   clear: () => boolean,
 * }}
 */
export function createHiddenParts() {
  /** @type {Set<string>} */
  const hidden = new Set();
  /** @type {string[][]} one entry per hide: the parts that hide took away */
  const history = [];
  return {
    has: (id) => hidden.has(id),
    size: () => hidden.size,
    ids: () => [...hidden],
    /** Hides the parts not hidden yet and returns them (none when there was nothing new to hide). */
    hide(ids) {
      const added = [...new Set(ids)].filter((id) => !hidden.has(id));
      if (!added.length) return [];
      for (const id of added) hidden.add(id);
      history.push(added);
      return added;
    },
    /** Brings back the parts the latest hide took away and returns them (none when nothing is hidden). */
    undo() {
      const last = history.pop() ?? [];
      for (const id of last) hidden.delete(id);
      return last;
    },
    /** Brings every part back. Returns whether there was anything to bring back. */
    clear() {
      const any = hidden.size > 0;
      hidden.clear();
      history.length = 0;
      return any;
    },
  };
}

/**
 * The part a keyboard user reaches by stepping from `currentId`, skipping hidden parts and wrapping round at either end. With nothing
 * chosen yet, forward starts at the first part and backward at the last. Returns undefined when every part is hidden.
 * @param {string[]} ids  every part, in the order the model lists them
 * @param {(id: string) => boolean} isHidden
 * @param {string | undefined} currentId
 * @param {1 | -1} direction
 * @returns {string | undefined}
 */
export function stepPart(ids, isHidden, currentId, direction) {
  const shown = ids.filter((id) => !isHidden(id) || id === currentId);
  if (!shown.length) return undefined;
  const at = currentId === undefined ? -1 : shown.indexOf(currentId);
  if (at < 0) return direction > 0 ? shown[0] : shown[shown.length - 1];
  return shown[(at + direction + shown.length) % shown.length];
}

/**
 * Where a part sits in the order a keyboard user steps through, for saying "part 12 of 61" without naming it.
 * @param {string[]} ids
 * @param {(id: string) => boolean} isHidden
 * @param {string | undefined} currentId
 * @returns {{ position: number, total: number }}
 */
export function stepPosition(ids, isHidden, currentId) {
  const shown = ids.filter((id) => !isHidden(id));
  return { position: currentId === undefined ? 0 : shown.indexOf(currentId) + 1, total: shown.length };
}
