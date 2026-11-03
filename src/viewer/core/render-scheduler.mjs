/** Coalesce interactive updates; flush keeps image capture synchronous. */
export function createRenderScheduler(draw, requestFrame = callback => requestAnimationFrame(callback), cancelFrame = handle => cancelAnimationFrame(handle)) {
  let pending;
  let disposed = false;
  const flush = () => {
    if (disposed) return;
    if (pending !== undefined) cancelFrame(pending);
    pending = undefined;
    draw();
  };
  return {
    request() { if (!disposed && pending === undefined) pending = requestFrame(flush); },
    flush,
    dispose() {
      disposed = true;
      if (pending !== undefined) cancelFrame(pending);
      pending = undefined;
    },
  };
}
