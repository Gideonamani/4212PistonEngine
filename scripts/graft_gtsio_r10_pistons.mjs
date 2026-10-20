// Replaces Piston1..6 in the unoptimised R10 source GLB with the pistons FreeCAD builds from the current recipe (cad_pipeline/gtsio_core.py, the
// neighbour-bay skirt relief), and leaves every other part byte for byte as it was. The frozen R10 build inputs (the 91 MB geometry.json and the
// part-spec of build/gtsio520-case-contours-r10) are not kept in Git, so the 20 October 2026 relief release was made this way instead of by a full rebuild:
//
//   python -c "import json,sys; sys.path.insert(0,'.'); from cad_pipeline import gtsio_core; from cad_pipeline.gtsio_layout import StaticEngineLayout; //              json.dump(gtsio_core.build(layout=StaticEngineLayout(complete_cylinders=True))[0], open('build/r10-pistons/spec-relief.json','w'), indent=1)"
//   "C:/Program Files/FreeCAD 1.1/bin/python.exe" cad_pipeline/generate.py --spec build/r10-pistons/spec-relief.json --output build/r10-pistons/relief //        --only Piston1 Piston2 Piston3 Piston4 Piston5 Piston6
//   node scripts/graft_gtsio_r10_pistons.mjs web/gtsio520-r10-static.glb.gz build/r10-pistons/relief/geometry.json build/r10-graft/web/gtsio520-r10-static.glb.gz
//   node scripts/build_gtsio_r10_optimized.mjs --into build/r10-graft/web --record build/r10-graft/record.json
//
// Positions follow the frozen pipeline (cad_pipeline/review_gtsio_r10.py): metres, glTF frame (x, y = CAD z, z = -CAD y). Normals follow cad_pipeline/look.py:
// smooth shading with the edges sharper than 30 degrees split (Blender's set_sharp_from_angle), corner-angle weighted. Checked on the recipe without the relief:
// Piston2 comes out with 6,392 vertices and 6,776 triangles against the frozen file's 6,390 and 6,774, so the tessellation matches to two triangles.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [inFile, geometryFile, outFile] = process.argv.slice(2);
if (!inFile || !geometryFile || !outFile) {
  console.error('usage: node scripts/graft_gtsio_r10_pistons.mjs <source.glb[.gz]> <piston geometry.json> <out.glb.gz>');
  process.exit(2);
}
const SMOOTH_ANGLE_DEG = 30;

function smoothMesh(verticesMm, triangles) {
  const pos = verticesMm.map(([x, y, z]) => [x / 1000, z / 1000, -y / 1000]);
  const faceNormals = [];
  const cornerAngles = [];
  let signedVolume = 0;
  for (const [a, b, c] of triangles) {
    const p = [pos[a], pos[b], pos[c]];
    const e1 = sub(p[1], p[0]);
    const e2 = sub(p[2], p[0]);
    const n = cross(e1, e2);
    const len = Math.hypot(...n);
    faceNormals.push(len > 0 ? n.map((v) => v / len) : [0, 0, 0]);
    const angles = [0, 1, 2].map((i) => {
      const u = sub(p[(i + 1) % 3], p[i]);
      const v = sub(p[(i + 2) % 3], p[i]);
      const lu = Math.hypot(...u);
      const lv = Math.hypot(...v);
      if (lu === 0 || lv === 0) return 0;
      return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (lu * lv))));
    });
    cornerAngles.push(angles);
    signedVolume += dot(p[0], cross(p[1], p[2])) / 6;
  }
  if (signedVolume <= 0) throw new Error(`triangle winding is inward (signed volume ${signedVolume})`);
  // edge -> faces
  const edgeFaces = new Map();
  const key = (i, j) => (i < j ? `${i}_${j}` : `${j}_${i}`);
  triangles.forEach((t, f) => {
    for (let i = 0; i < 3; i++) {
      const k = key(t[i], t[(i + 1) % 3]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k).push(f);
    }
  });
  const cosLimit = Math.cos((SMOOTH_ANGLE_DEG * Math.PI) / 180);
  const sharp = (k) => {
    const faces = edgeFaces.get(k);
    if (faces.length !== 2) return false;
    return dot(faceNormals[faces[0]], faceNormals[faces[1]]) < cosLimit;
  };
  // per vertex: faces around it
  const vertexFaces = pos.map(() => []);
  triangles.forEach((t, f) => t.forEach((v, i) => vertexFaces[v].push([f, i])));
  const outPositions = [];
  const outNormals = [];
  const cornerIndex = triangles.map(() => [0, 0, 0]);
  for (let v = 0; v < pos.length; v++) {
    const around = vertexFaces[v];
    const parent = around.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    // two faces around v are joined if they share a non-sharp edge that contains v
    const byEdge = new Map();
    around.forEach(([f, i], idx) => {
      const t = triangles[f];
      for (const other of [t[(i + 1) % 3], t[(i + 2) % 3]]) {
        const k = key(v, other);
        if (!byEdge.has(k)) byEdge.set(k, []);
        byEdge.get(k).push(idx);
      }
    });
    for (const [k, members] of byEdge) {
      if (members.length < 2 || sharp(k)) continue;
      for (let m = 1; m < members.length; m++) parent[find(members[m])] = find(members[0]);
    }
    const fans = new Map();
    around.forEach(([f, i], idx) => {
      const root = find(idx);
      if (!fans.has(root)) fans.set(root, { sum: [0, 0, 0], corners: [] });
      const fan = fans.get(root);
      const w = cornerAngles[f][i];
      for (let c = 0; c < 3; c++) fan.sum[c] += faceNormals[f][c] * w;
      fan.corners.push([f, i]);
    });
    for (const fan of fans.values()) {
      const len = Math.hypot(...fan.sum);
      const normal = len > 0 ? fan.sum.map((c) => c / len) : [0, 1, 0];
      const index = outPositions.length / 3;
      outPositions.push(...pos[v]);
      outNormals.push(...normal);
      for (const [f, i] of fan.corners) cornerIndex[f][i] = index;
    }
  }
  return { positions: new Float32Array(outPositions), normals: new Float32Array(outNormals), indices: cornerIndex.flat(), signedVolume };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.readBinary(new Uint8Array(zlib.gunzipSync(fs.readFileSync(inFile))));
const geometryBytes = fs.readFileSync(geometryFile);
const geometry = JSON.parse(geometryBytes);
const geometrySha = crypto.createHash('sha256').update(geometryBytes).digest('hex');
for (let n = 1; n <= 6; n++) {
  const part = geometry.parts.find((p) => p.id === `Piston${n}`);
  const node = doc.getRoot().listNodes().find((x) => x.getName() === `Piston${n}`);
  if (!part || !node) throw new Error(`Piston${n} missing`);
  const prim = node.getMesh().listPrimitives()[0];
  const before = { vertices: prim.getAttribute('POSITION').getCount(), indices: prim.getIndices().getCount() };
  const mesh = smoothMesh(part.vertices_mm, part.triangles);
  prim.getAttribute('POSITION').setArray(mesh.positions);
  prim.getAttribute('NORMAL').setArray(mesh.normals);
  prim.getIndices().setArray(mesh.indices.length && Math.max(...mesh.indices) < 65536 ? new Uint16Array(mesh.indices) : new Uint32Array(mesh.indices));
  const extras = { ...node.getExtras(), source_geometry_sha256: geometrySha, scope: 'Piston re-tessellated from the FreeCAD recipe with the neighbour-bay skirt relief (illustrative modelling decision, no source for the real piston); other parts are the frozen R10 direct tessellation; private unaccepted review' };
  node.setExtras(extras);
  console.log(`Piston${n}: vertices ${before.vertices} -> ${mesh.positions.length / 3}, indices ${before.indices} -> ${mesh.indices.length}, volume ${(mesh.signedVolume * 1e9).toFixed(0)} mm3`);
}
const out = await io.writeBinary(doc);
fs.writeFileSync(outFile, zlib.gzipSync(Buffer.from(out), { level: 9 }));
console.log(`${outFile}: ${out.length} bytes decoded, geometry sha256 ${geometrySha}`);
