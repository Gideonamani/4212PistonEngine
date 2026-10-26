// What the service worker keeps on the device (issue #77). Pure, so the rule is tested without a build or a browser;
// scripts/build_service_worker.mjs applies it to the built site.
//
//   core   saved when the service worker installs: the app's code and styles, the page, the lesson packs, contracts and part lists, and
//          the small pictures (thumbnails, banners, model previews, icons). About 6 MB, so one visit online makes the app and every
//          lesson's text usable without a connection.
//   media  lesson pictures and audio, about 4 MB more. Each is saved the first time it is shown, and all of them when the learner asks
//          to save the course for offline use, so a first visit on mobile data does not pay for pictures it never opens.
//
// Model files are never here: a production build carries none (prune_deployed_models.mjs), and a downloaded model is kept by
// src/viewer/core/model-cache.mjs instead.

/** Folders whose files are saved on demand, not at install. */
export const MEDIA_FOLDERS = Object.freeze(['lesson-media/', 'audio/']);

// The worker itself, source maps, model and CAD files, and the files a host serves about the site rather than for it.
const LEFT_OUT = [/^sw\.js$/, /\.map$/, /\.(glb|gltf|stl|step|stp|fcstd|blend)(\.gz)?$/i, /^\.nojekyll$/, /^CNAME$/, /(^|\/)\.DS_Store$/];

/**
 * Splits the built site's files (paths relative to its root, with forward slashes) into what is saved at install and what on demand.
 * @param {string[]} files
 * @returns {{ core: string[], media: string[] }}
 */
export function precachePlan(files) {
  const core = [];
  const media = [];
  for (const file of [...new Set(files)].sort()) {
    if (LEFT_OUT.some((pattern) => pattern.test(file))) continue;
    (MEDIA_FOLDERS.some((folder) => file.startsWith(folder)) ? media : core).push(file);
  }
  if (!core.includes('index.html')) throw new Error('the built site has no index.html');
  return { core, media };
}

/**
 * A short name for one build's saved files: it changes whenever any file's content does, so a new deployment replaces the old saved copy
 * and an unchanged one keeps it. FNV-1a over each path and its content hash.
 * @param {[string, string][]} entries  [path, content hash] pairs
 * @returns {string}
 */
export function cacheVersion(entries) {
  let hash = 0x811c9dc5;
  for (const [path, digest] of [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    for (const char of `${path}:${digest}\n`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(36);
}
