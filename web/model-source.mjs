// Where the browser downloads a published model from.
// Published GLBs live in the project's synced Google Drive folder and are read
// through the Drive API with the restricted browser key (docs/decisions/001).
// They are not committed to git. On localhost, local copies in web/ are tried
// first so development works offline and before a model reaches Drive.

const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
let configRequest;

export function deliveryConfig() {
  configRequest ??= fetch('./config.json').then(response => response.ok ? response.json() : {}).catch(() => ({}));
  return configRequest;
}

// Same request options for every model download: no cookies, and the page origin
// as referrer so the key's website restriction can match it.
export const fetchOptions = headers => ({headers, mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin'});

/**
 * Ordered download candidates for one model.
 * @param {Array<{driveId?:string, localUrl?:string}>} variants preferred first
 *   (normally the gzip transport, then the raw GLB fallback). Any other fields
 *   on a variant, such as `compressed`, are carried onto its candidates.
 * @returns {Promise<Array<{url:string, headers:object}>>}
 */
export async function modelSources(variants) {
  const {drive_api_key: apiKey = ''} = await deliveryConfig();
  const drive = variants.filter(v => v.driveId && apiKey).map(({driveId, localUrl, ...rest}) => ({
    ...rest,
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media`,
    headers: {'X-Goog-Api-Key': apiKey},
  }));
  const local = variants.filter(v => v.localUrl).map(({driveId, localUrl, ...rest}) => ({...rest, url: localUrl, headers: {}}));
  return isLocalHost ? [...local, ...drive] : drive;
}
