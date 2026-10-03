import { useMemo, useSyncExternalStore } from 'react';
import { formatRoute, parseHash, type Route } from './route.mjs';

export type { Route };

const ROUTE_EVENT = 'app:routechange';

const subscribe = (notify: () => void) => {
  // history.pushState and replaceState fire no event of their own, so navigate() announces its changes on ROUTE_EVENT.
  window.addEventListener('hashchange', notify);
  window.addEventListener('popstate', notify);
  window.addEventListener(ROUTE_EVENT, notify);
  return () => {
    window.removeEventListener('hashchange', notify);
    window.removeEventListener('popstate', notify);
    window.removeEventListener(ROUTE_EVENT, notify);
  };
};

/** The current route. Re-renders when the address changes, by link, Back button or navigate(). */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

/** Go to a route. `replace` swaps the current history entry instead of adding one (for changes that should not need a Back press). */
export function navigate(route: Route, { replace = false }: { replace?: boolean } = {}) {
  const hash = formatRoute(route);
  if (hash === location.hash) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', `${location.pathname}${location.search}${hash}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}
