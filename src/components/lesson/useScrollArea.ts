import { useLayoutEffect, type RefObject } from 'react';

/**
 * Publishes the height of a scrolling element, in pixels, as the CSS variable `--lesson-area` on that element. The 3D viewer's height
 * is a share of this (see index.css), so it follows the element that actually scrolls: not the window, which includes the app header,
 * and not `dvh`, which moves with the phone's address bar. Written straight to the style, so a resize never re-renders React.
 */
export function useScrollArea(target: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = target.current;
    if (!element) return;
    const publish = () => element.style.setProperty('--lesson-area', `${element.clientHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);
}
