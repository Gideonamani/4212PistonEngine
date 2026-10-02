// Test assets may be restored locally or in CI. Production model bytes stay on Drive.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
for (const entry of JSON.parse(fs.readFileSync('docs/drive-asset-manifest.json', 'utf8')).web_assets) {
  if (!entry.drive_id) throw Error(`Unpublished Drive asset: ${entry.path}`);
  const target = path.resolve(root, entry.path.replace(/^web\//, ''));
  if (!target.startsWith(root + path.sep)) throw Error('Invalid deployed model path');
  fs.rmSync(target, { force: true });
}
function prune(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.resolve(directory, item.name);
    if (!target.startsWith(root + path.sep)) throw Error('Invalid deployed asset path');
    if (item.isDirectory()) prune(target);
    else if (/\.(glb(?:\.gz)?|FCStd|blend|step|stp)$/i.test(item.name)) fs.rmSync(target);
  }
}
prune(root);
