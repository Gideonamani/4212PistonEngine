// Which way torque travels through a drive train, worked out from the contract's power paths. Pure data, no three.js: the tests check the
// answer against the contract's own gear meshes (driver and driven), so a ribbon cannot run against the gears it is drawn over.
//
// A power path lists its edges as [from, to] pairs, but what an edge means depends on what is driving. In normal running the crankshaft
// gear drives every accessory; while the engine is being started the starter drives the crankshaft gear, so the starter path points the
// other way into the same gear. Showing every path's edges as listed, all the time, drew the starter's torque running backwards against the
// train while the engine ran. So each flow here is oriented away from its source, and a path that feeds the hub is idle in normal running.

/**
 * Point every edge away from `source`: an edge runs from the part nearer the source to the part farther from it.
 * Edges the source cannot reach keep their listed direction and get `hops` of Infinity.
 * @param {string[][]} edges  [from, to] pairs as listed in a power path; the graph is treated as undirected.
 * @param {string} source  The part torque enters at.
 * @returns {{ from: string, to: string, hops: number }[]}  Nearest the source first.
 */
export function orientEdges(edges, source) {
  const neighbours = new Map();
  const link = (a, b) => { if (!neighbours.has(a)) neighbours.set(a, []); neighbours.get(a).push(b); };
  for (const [a, b] of edges) { link(a, b); link(b, a); }
  const hops = new Map([[source, 0]]);
  const queue = [source];
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of neighbours.get(queue[head]) || []) {
      if (!hops.has(next)) { hops.set(next, hops.get(queue[head]) + 1); queue.push(next); }
    }
  }
  return edges
    .map(([a, b]) => {
      const ha = hops.get(a) ?? Infinity;
      const hb = hops.get(b) ?? Infinity;
      return hb < ha ? { from: b, to: a, hops: hb } : { from: a, to: b, hops: ha };
    })
    .sort((x, y) => x.hops - y.hops);
}

/** The part most paths start from: the gear that every accessory is driven from. */
export function hubOf(paths) {
  const starts = new Map();
  for (const path of paths) { const start = path.edges?.[0]?.[0]; if (start) starts.set(start, (starts.get(start) || 0) + 1); }
  return [...starts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** A path is inbound when it feeds the hub (the starter turns the crankshaft gear) instead of being driven from it. */
export const isInboundPath = (path, hub) => (path.edges || []).some(([, to]) => to === hub);

/** The path a motion is about, by the path's id appearing in the motion's id ('Focus: magnetos', 'Starter engagement and start'). */
export function pathForMotion(paths, motionId) {
  const id = String(motionId || '').toLowerCase();
  return [...paths].sort((a, b) => b.id.length - a.id.length).find((path) => id.includes(path.id.toLowerCase()));
}

/**
 * What to draw: one chosen path (selected in the panel, or the one a motion is about) oriented from its own source, or, with none,
 * every path that is driven from the hub, oriented away from it, with each shared edge drawn once.
 * @returns {{ mode: 'path' | 'running', pathId: string, label: string, inbound: boolean, hub: string | undefined, edges: { from: string, to: string, hops: number }[] }}
 */
export function driveTrainPlan(paths, { activePathId, motionId } = {}) {
  const hub = hubOf(paths);
  const chosen = paths.find((path) => path.id === activePathId) || pathForMotion(paths, motionId);
  if (chosen) {
    const source = chosen.edges?.[0]?.[0];
    return {
      mode: 'path',
      pathId: chosen.id,
      label: chosen.label,
      inbound: isInboundPath(chosen, hub),
      hub,
      edges: orientEdges(chosen.edges || [], source),
    };
  }
  const driven = paths.filter((path) => !isInboundPath(path, hub));
  const unique = new Map();
  for (const path of driven) for (const [a, b] of path.edges || []) if (!unique.has(`${a}|${b}`) && !unique.has(`${b}|${a}`)) unique.set(`${a}|${b}`, [a, b]);
  return {
    mode: 'running',
    pathId: '',
    label: 'Accessory gear train',
    inbound: false,
    hub,
    edges: orientEdges([...unique.values()], hub),
  };
}
