import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampHeight, clampPosition, formatPosition, parseHeight, parsePosition } from './core/floating-position.mjs';

type Point = { x: number; y: number };

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | undefined) => {
  try { if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* not remembered */ }
};

// Capture keeps a drag going when the finger leaves the handle. It can throw (a pointer that is already gone), and a drag must still end and be kept.
const capture = (element: HTMLElement, pointer: number, on: boolean) => {
  try { if (on) element.setPointerCapture(pointer); else if (element.hasPointerCapture?.(pointer)) element.releasePointerCapture(pointer); } catch { /* drag continues uncaptured */ }
};

const ARROWS: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };

/**
 * A panel the learner can drag anywhere over the model (Explore's part card). Until it is first moved it sits where its own classes put
 * it; once moved, its top-left corner is kept on this device and the panel stays there, on every model, until it is moved again. The
 * corner is pulled back inside the model area whenever that area or the panel changes size, without forgetting where it was put.
 *
 * `grip` goes on the panel's handle (pointer drag, arrow keys to nudge, Home to put it back); `dragArea` on a larger area, such as the
 * title row, that can be dragged too, without its buttons starting a drag.
 */
export function useFloatingPosition(key: string, container: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLElement | null>) {
  const [stored, setStored] = useState<Point | undefined>(() => parsePosition(read(key)));
  const [shown, setShown] = useState<Point | undefined>(stored);
  // The drag's latest corner, kept here rather than read back from the page, which a quick flick can outrun.
  const drag = useRef<{ pointer: number; offset: Point; latest?: Point } | undefined>(undefined);

  const fit = useCallback((point: Point) => {
    const bounds = container.current?.getBoundingClientRect();
    const size = panel.current?.getBoundingClientRect();
    return bounds && size ? clampPosition(point, size, bounds) : point;
  }, [container, panel]);

  // Re-fit the remembered corner when the model area or the panel resizes (the drawer dragged, a phone turned, the card expanded).
  useLayoutEffect(() => {
    if (!stored) { setShown(undefined); return; }
    const refit = () => setShown(fit(stored));
    refit();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refit);
    if (container.current) observer?.observe(container.current);
    if (panel.current) observer?.observe(panel.current);
    return () => observer?.disconnect();
  }, [stored, fit, container, panel]);

  const place = (point: Point) => { const next = fit(point); setStored(next); setShown(next); write(key, formatPosition(next)); };
  const reset = () => { setStored(undefined); setShown(undefined); write(key, undefined); };

  const start = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !panel.current) return;
    const box = panel.current.getBoundingClientRect();
    drag.current = { pointer: event.pointerId, offset: { x: event.clientX - box.left, y: event.clientY - box.top } };
    capture(event.currentTarget, event.pointerId, true);
    event.preventDefault();
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    const bounds = container.current?.getBoundingClientRect();
    if (!current || current.pointer !== event.pointerId || !bounds) return;
    current.latest = fit({ x: event.clientX - bounds.left - current.offset.x, y: event.clientY - bounds.top - current.offset.y });
    setShown(current.latest);
  };
  const end = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = undefined;
    capture(event.currentTarget, event.pointerId, false);
    // A press that never moved is a tap, not a move: the card keeps its place (and a card never moved keeps its default corner).
    if (current.latest) place(current.latest);
  };
  const pointer = { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end };

  const keys = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Home') { event.preventDefault(); reset(); return; }
    const step = ARROWS[event.key];
    const bounds = container.current?.getBoundingClientRect();
    const box = panel.current?.getBoundingClientRect();
    if (!step || !bounds || !box) return;
    event.preventDefault();
    const distance = event.shiftKey ? 64 : 16;
    place({ x: box.left - bounds.left + step.x * distance, y: box.top - bounds.top + step.y * distance });
  };

  return {
    /** The panel's position while it has been moved; undefined while it sits where its classes put it. */
    position: shown,
    grip: { ...pointer, onKeyDown: keys, onDoubleClick: reset, style: { touchAction: 'none' } as React.CSSProperties },
    dragArea: {
      ...pointer,
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => { if (!(event.target as HTMLElement).closest('button, a, input, select, summary')) start(event); },
      style: { touchAction: 'none' } as React.CSSProperties,
    },
    reset,
  };
}

/**
 * A drawer whose height the learner drags (Explore's controls under the model on a phone or a narrow window). Until it is dragged it keeps
 * the height its classes give it; after that the height is kept on this device and held within limits that leave the model room.
 */
export function useDrawerHeight(key: string, section: React.RefObject<HTMLElement | null>, drawer: React.RefObject<HTMLElement | null>, { min = 120, keep = 128 } = {}) {
  const [stored, setStored] = useState<number | undefined>(() => parseHeight(read(key) ?? ''));
  const [available, setAvailable] = useState(0);
  // The drag's latest height is kept here, not read from the last render: a quick flick can lift the finger before React redraws.
  const drag = useRef<{ pointer: number; startY: number; startHeight: number; latest?: number } | undefined>(undefined);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const measure = () => setAvailable(element.getBoundingClientRect().height);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [section]);

  const limit = (value: number) => clampHeight(value, { min, available: available || window.innerHeight, keep });
  const height = stored === undefined ? undefined : limit(stored);
  const set = (value: number, remember: boolean) => { const next = limit(value); setStored(next); if (remember) write(key, String(next)); };
  const currentHeight = () => height ?? drawer.current?.getBoundingClientRect().height ?? min;

  return {
    height,
    reset: () => { setStored(undefined); write(key, undefined); },
    separator: {
      role: 'separator',
      'aria-orientation': 'horizontal' as const,
      'aria-valuemin': min,
      'aria-valuemax': Math.max(min, Math.round((available || 0) - keep)),
      'aria-valuenow': Math.round(currentHeight()),
      tabIndex: 0,
      style: { touchAction: 'none' } as React.CSSProperties,
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        drag.current = { pointer: event.pointerId, startY: event.clientY, startHeight: currentHeight() };
        capture(event.currentTarget, event.pointerId, true);
        event.preventDefault();
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || current.pointer !== event.pointerId) return;
        current.latest = limit(current.startHeight + current.startY - event.clientY);
        set(current.latest, false);
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || current.pointer !== event.pointerId) return;
        drag.current = undefined;
        capture(event.currentTarget, event.pointerId, false);
        if (current.latest !== undefined) set(current.latest, true);
      },
      onPointerCancel: () => { drag.current = undefined; },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        const step = event.shiftKey ? 96 : 32;
        if (event.key === 'ArrowUp') { event.preventDefault(); set(currentHeight() + step, true); }
        else if (event.key === 'ArrowDown') { event.preventDefault(); set(currentHeight() - step, true); }
        else if (event.key === 'Home') { event.preventDefault(); setStored(undefined); write(key, undefined); }
      },
      onDoubleClick: () => { setStored(undefined); write(key, undefined); },
    },
  };
}
