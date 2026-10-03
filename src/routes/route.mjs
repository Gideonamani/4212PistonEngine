// The app's address, kept in the URL hash so every screen can be bookmarked and the browser Back button works:
//   #/explore    #/check    #/learn    #/learn/<course>    #/learn/<course>/<lesson>/step/<n>    #/learn/<course>/<lesson>/complete
// Pure functions only; useRoute.ts connects them to the browser.

/**
 * @typedef {{ view: 'explore' } | { view: 'check' } | { view: 'learn', course?: string, lesson?: string, step?: number, complete?: boolean }} Route
 */

const safeDecode = (part) => {
  try { return decodeURIComponent(part); } catch { return part; }
};

/**
 * The route a hash stands for. Anything unrecognised is Explore, and a missing or invalid step number is step 1.
 * @param {string} hash
 * @returns {Route}
 */
export function parseHash(hash) {
  const [view, course, lesson, tail, number] = hash.replace(/^#\/?/, '').split('/').map(safeDecode);
  if (view === 'check') return { view: 'check' };
  if (view !== 'learn') return { view: 'explore' };
  const route = { view: 'learn' };
  if (course) route.course = course;
  if (course && lesson) {
    route.lesson = lesson;
    if (tail === 'complete') route.complete = true;
    else if (tail === 'step') route.step = Math.max(Math.floor(Number(number)) || 1, 1);
  }
  return route;
}

/**
 * The hash for a route; parseHash(formatRoute(route)) gives the route back.
 * @param {Route} route
 * @returns {string}
 */
export function formatRoute(route) {
  if (route.view !== 'learn') return `#/${route.view}`;
  let hash = '#/learn';
  if (route.course) {
    hash += `/${encodeURIComponent(route.course)}`;
    if (route.lesson) {
      hash += `/${encodeURIComponent(route.lesson)}`;
      if (route.complete) hash += '/complete';
      else if (route.step) hash += `/step/${route.step}`;
    }
  }
  return hash;
}

/**
 * The course and lesson a Learn route names, if they exist. A deep dive is a lesson that is not in the course's own list.
 * @template {{ id: string, lessons: { id: string }[], deepDives?: { id: string }[] }} T
 * @param {T[]} tracks
 * @param {Route} route
 * @returns {{ track?: T, lesson?: T['lessons'][number] }}
 */
export function resolveLearn(tracks, route) {
  if (route.view !== 'learn') return {};
  const track = tracks.find((item) => item.id === route.course);
  const lesson = track && (track.lessons.find((item) => item.id === route.lesson) || track.deepDives?.find((item) => item.id === route.lesson));
  return { track, lesson };
}
