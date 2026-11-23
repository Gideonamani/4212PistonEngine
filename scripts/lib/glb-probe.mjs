// Reads part positions out of a GLB (or .glb.gz) without three.js or a browser: the world-space box of every named node, from the
// accessor bounds and the node transforms in the file's JSON chunk. Tests use it to check where parts really sit in a model, so
// a rule about "which end of a cylinder is the head" is tested against the shipped geometry and not only against made-up numbers.
// Returns undefined when the file is not on this machine (models are not in Git; scripts/fetch_drive_assets.py restores them).

import fs from 'node:fs';
import zlib from 'node:zlib';

/** Column-major 4x4 product a·b. */
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

function localMatrix(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const transformPoint = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** @returns {Map<string, { min: number[], max: number[], center: number[], size: number[] }> | undefined} */
export function readPartBoxes(path) {
  if (!fs.existsSync(path)) return undefined;
  const raw = fs.readFileSync(path);
  const bytes = path.endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const nodes = gltf.nodes || [];
  const parent = new Map();
  nodes.forEach((node, index) => (node.children || []).forEach((child) => parent.set(child, index)));

  const worldCache = new Map();
  const worldOf = (index) => {
    if (!worldCache.has(index)) {
      const local = localMatrix(nodes[index]);
      worldCache.set(index, parent.has(index) ? multiply(worldOf(parent.get(index)), local) : local);
    }
    return worldCache.get(index);
  };
  const subtree = (index) => [index, ...(nodes[index].children || []).flatMap(subtree)];

  const boxes = new Map();
  nodes.forEach((node, index) => {
    if (!node.name) return;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const member of subtree(index)) {
      const mesh = nodes[member].mesh;
      if (mesh === undefined) continue;
      const matrix = worldOf(member);
      for (const primitive of gltf.meshes[mesh].primitives) {
        const accessor = gltf.accessors[primitive.attributes.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        for (const x of [accessor.min[0], accessor.max[0]]) for (const y of [accessor.min[1], accessor.max[1]]) for (const z of [accessor.min[2], accessor.max[2]]) {
          const point = transformPoint(matrix, [x, y, z]);
          for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
        }
      }
    }
    if (min[0] === Infinity) return;
    boxes.set(node.name, { min, max, center: min.map((v, i) => (v + max[i]) / 2), size: min.map((v, i) => max[i] - v) });
  });
  return boxes;
}
