// When the app may download models nobody has asked for yet. Pure, so the rule is tested without a browser.

/**
 * @param {{ connection?: { saveData?: boolean, type?: string, effectiveType?: string }, automated?: boolean }} situation
 * `connection` is navigator.connection where the browser has it; `automated` is navigator.webdriver.
 * Background downloads are welcome on an ordinary fast connection, and not:
 *  - when the visitor asked the browser to save data,
 *  - on mobile data (students may pay for it),
 *  - on a network the browser rates below 4g,
 *  - in an automated browser, which is a test run that should only fetch what it asked for.
 */
export function prefetchAllowed({ connection, automated = false } = {}) {
  if (automated) return false;
  if (!connection) return true;
  if (connection.saveData || connection.type === 'cellular') return false;
  return !connection.effectiveType || connection.effectiveType === '4g';
}
