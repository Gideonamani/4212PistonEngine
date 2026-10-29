// Reads GLB models (plain, gzipped, or packed with EXT_meshopt_compression) and reports how their own materials will look before any viewer
// code touches them: each material's base colour (sRGB) and luminance, metalness, roughness, texture and vertex-colour use, weighted by the
// triangles that carry it, and how far the vertex normals lean from the face they sit on. It changes nothing. docs/model-finishes-2026-10-29.md
// says what the numbers meant for each model.
//
//   node scripts/audit_model_finish.mjs web/oil-pump.glb.gz [more.glb ...]        (ROWS=n sets how many materials are listed, default 12)
//
// A part reads as washed out when its base colour is pale (luminance above about 0.75) and its metalness is high, because a polished metal
// reflects the lit room and not its own colour; and a model reads as one colour when most triangles share one material.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const rows = Number(process.env.ROWS) || 12;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const toSrgb = (value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
const hex = (rgb) => `#${rgb.slice(0, 3).map((value) => Math.round(Math.min(1, Math.max(0, toSrgb(value))) * 255).toString(16).padStart(2, '0')).join('')}`;
const luminance = (rgb) => { const [r, g, b] = rgb.slice(0, 3).map(toSrgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/** Mean angle (degrees) between a vertex normal and the flat face it belongs to, over a sample of the primitive's triangles, and how many corners lean over 25. */
function normalLean(primitive, triangles) {
  const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL'), indices = primitive.getIndices();
  if (!position || !normal || !indices || !triangles) return { sum: 0, count: 0, steep: 0 };
  const step = Math.max(1, Math.floor(triangles / 400));
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], n = [0, 0, 0];
  let sum = 0, count = 0, steep = 0;
  for (let triangle = 0; triangle < triangles; triangle += step) {
    const corners = [0, 1, 2].map((offset) => indices.getScalar(triangle * 3 + offset));
    position.getElement(corners[0], a); position.getElement(corners[1], b); position.getElement(corners[2], c);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const face = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const length = Math.hypot(...face);
    if (!length) continue;
    for (const corner of corners) {
      normal.getElement(corner, n);
      const degrees = Math.acos(Math.max(-1, Math.min(1, (face[0] * n[0] + face[1] * n[1] + face[2] * n[2]) / (length * Math.hypot(...n))))) * 180 / Math.PI;
      sum += degrees * step; count += step; if (degrees > 25) steep += step;
    }
  }
  return { sum, count, steep };
}

for (const file of process.argv.slice(2)) {
  let bytes = fs.readFileSync(file);
  if (file.endsWith('.gz')) bytes = zlib.gunzipSync(bytes);
  const document = await io.readBinary(new Uint8Array(bytes));
  const byMaterial = new Map();
  let triangles = 0, corners = 0, vertices = 0, meshes = 0;
  const lean = { sum: 0, count: 0, steep: 0 };
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    meshes += 1;
    for (const primitive of mesh.listPrimitives()) {
      const count = (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3;
      triangles += count; corners += count * 3; vertices += primitive.getAttribute('POSITION')?.getCount() ?? 0;
      const sample = normalLean(primitive, count);
      lean.sum += sample.sum; lean.count += sample.count; lean.steep += sample.steep;
      const material = primitive.getMaterial();
      const key = material?.getName() || '(default)';
      const row = byMaterial.get(key) ?? { material, triangles: 0, vertexColours: false };
      row.triangles += count; row.vertexColours ||= Boolean(primitive.getAttribute('COLOR_0'));
      byMaterial.set(key, row);
    }
  }
  const list = [...byMaterial.values()].sort((first, second) => second.triangles - first.triangles);
  const meanLuminance = list.reduce((sum, row) => sum + (row.material ? luminance(row.material.getBaseColorFactor()) : 1) * row.triangles, 0) / Math.max(triangles, 1);
  console.log(`\n${path.basename(file)}: ${meshes} meshes, ${triangles} triangles, ${list.length} materials, ${document.getRoot().listTextures().length} textures`);
  console.log(`  mean base-colour luminance by triangle ${meanLuminance.toFixed(2)}; vertices per triangle corner ${(vertices / Math.max(corners, 1)).toFixed(2)}; normals lean ${(lean.sum / Math.max(lean.count, 1)).toFixed(1)} deg from the face on average, ${(100 * lean.steep / Math.max(lean.count, 1)).toFixed(1)}% of corners over 25 deg`);
  console.log('  material | base colour | luminance | metalness | roughness | share of triangles');
  for (const { material, triangles: share, vertexColours } of list.slice(0, rows)) {
    if (!material) { console.log(`  (default) | - | - | - | - | ${(100 * share / triangles).toFixed(1)}%`); continue; }
    const base = material.getBaseColorFactor();
    console.log(`  ${material.getName()} | ${hex(base)}${base[3] < 1 ? ` alpha ${base[3].toFixed(2)}` : ''}${vertexColours ? ' +vertex colours' : ''}${material.getBaseColorTexture() ? ' +texture' : ''} | ${luminance(base).toFixed(2)} | ${material.getMetallicFactor().toFixed(2)} | ${material.getRoughnessFactor().toFixed(2)} | ${(100 * share / triangles).toFixed(1)}%`);
  }
  if (list.length > rows) console.log(`  ... ${list.length - rows} more`);
}
