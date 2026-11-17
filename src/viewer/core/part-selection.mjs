/**
 * Selection transitions shared by Explore's canvas, list and card. The adapters render the
 * result; their inspected ID is never used as an implicit fallback for an empty selection.
 * @param {import('../types').ViewerFeatures} features
 * @param {() => import('../types').ViewerSnapshot} snapshot
 * @param {() => void} changed
 */
export function createPartSelection(features, snapshot, changed) {
  const components = features.components;
  const known = new Set(components.items.map(part => part.id));
  /** @type {string[]} */
  let ids = [];
  /** @type {import('../types').FocusMode | undefined} */
  let mode;

  const replace = (next, requestedMode = mode ?? 'highlight') => {
    ids = [...new Set(next)].filter(id => known.has(id));
    mode = ids.length ? requestedMode : undefined;
    components.select(ids.length === 1 ? ids[0] : '');
    features.focus?.set(ids, mode ?? 'highlight', { closeUp: true });
    changed();
  };

  return {
    selectedIds: () => ids,
    select(id) { if (!id || known.has(id)) replace(id ? [id] : []); },
    replace,
    toggle(id) { if (known.has(id)) replace(ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]); },
    toggleMany(groupIds) {
      const valid = groupIds.filter(id => known.has(id));
      if (valid.length) replace(valid.every(id => ids.includes(id)) ? ids.filter(id => !valid.includes(id)) : [...ids, ...valid]);
    },
    add(next) { replace([...ids, ...next]); },
    choose(nextMode) {
      if (!ids.length || !features.focus) return;
      const current = snapshot();
      mode = current.focusActive && current.focusMode === nextMode ? undefined : nextMode;
      features.focus.set(mode ? ids : [], nextMode, { closeUp: true });
      changed();
    },
    isolate(id) { if (known.has(id)) replace([id], 'isolate'); },
    clear() {
      ids = [];
      mode = undefined;
      components.showAll();
      changed();
    },
  };
}
