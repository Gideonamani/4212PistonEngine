// The order a model is tried in. Pure, so the rule can be tested without a browser. assets.ts turns each entry into a request.

/**
 * @typedef {{ localUrl?: string, driveId?: string }} Source
 * @typedef {{ source: Source, from: 'local' | 'drive' }} Attempt
 */

/**
 * The attempts to make, in order: local copies first, then Drive.
 *
 * A production build deletes every model file from `dist` (prune_deployed_models.mjs), so a local request there can only 404
 * before Drive is tried. In production, a source that Drive can serve skips its local attempt. A source Drive cannot serve
 * (no Drive id, or no API key) keeps it, so a self-hosted build that bundles its models still works.
 *
 * @param {Source[]} sources
 * @param {{ apiKey?: string, production?: boolean }} options
 * @returns {Attempt[]}
 */
export function orderAttempts(sources, { apiKey = '', production = false } = {}) {
  const viaDrive = (source) => Boolean(apiKey && source.driveId);
  return [
    ...sources.filter((source) => source.localUrl && !(production && viaDrive(source))).map((source) => ({ source, from: 'local' })),
    ...sources.filter(viaDrive).map((source) => ({ source, from: 'drive' })),
  ];
}
