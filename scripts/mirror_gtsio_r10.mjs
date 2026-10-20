// Reflects the unoptimised R10 source GLB in x (CAD x is glTF x): the geometry half of the handedness fix (docs/r10-handedness.md).
//
//   node scripts/mirror_gtsio_r10.mjs <source.glb[.gz]> <out.glb.gz>
//
// The frozen CAD build has the odd cylinders on +X, which is the left side looking forward from the accessory end; the manual and the real engine have them on the
// right. cad_pipeline/gtsio_layout.py EXPORT_MIRROR_X says the review export is the reflection x -> -x of that frame, and the motion, the contract and the checks are
// written that way (cad_pipeline/gtsio_review_motion.py, src/viewer/core/animated-study-motion.mjs). The frozen CAD inputs that would let FreeCAD rebuild the
// 1,396 parts in the other handedness are not in the repository (build/gtsio520-case-contours-r10/ is an ignored build output), so the geometry is reflected here
// instead, exactly: positions and normals change x, and the winding of every triangle is reversed so the faces keep pointing outwards. Nothing else changes: part
// names, node order, materials, extras and the other two coordinates are kept, and a reflection is an isometry, so every clearance and overlap is unchanged.
// Run it on the source (unoptimised) file, then scripts/build_gtsio_r10_optimized.mjs.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) throw new Error('usage: node scripts/mirror_gtsio_r10.mjs <source.glb[.gz]> <out.glb.gz>');

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let bytes = fs.readFileSync(inFile);
if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
const doc = await io.readBinary(new Uint8Array(bytes));
const root = doc.getRoot();

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const isIdentity = (node) => node.getMatrix().every((v, i) => Math.abs(v - identity[i]) < 1e-12);
const seen = new Set();
const done = new Set(); // accessors are shared between primitives (identical fasteners share an index buffer): reflect each one once
let parts = 0;
let triangles = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  // the reflection is applied to the vertex data, so the world matrix of every meshed node must be the identity (the parts are baked at their world positions)
  for (let up = node; up; up = up.getParentNode()) {
    if (!isIdentity(up)) throw new Error(`${node.getName()}: node ${up.getName()} carries a transform; the reflection assumes baked world positions`);
  }
  if (!seen.has(mesh)) {
    seen.add(mesh);
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute('TANGENT')) throw new Error(`${mesh.getName()}: tangents are not handled`);
      if (prim.getMode() !== 4) throw new Error(`${mesh.getName()}: only triangle lists are handled`);
      const position = prim.getAttribute('POSITION');
      const normal = prim.getAttribute('NORMAL');
      const reflectX = (accessor) => {
        if (done.has(accessor)) return;
        done.add(accessor);
        const array = accessor.getArray().slice();
        for (let i = 0; i < array.length; i += 3) array[i] = 0 - array[i];
        accessor.setArray(array);
      };
      reflectX(position);
      if (normal) reflectX(normal);
      const indices = prim.getIndices();
      if (!indices) throw new Error(`${mesh.getName()}: a non-indexed primitive is not handled`);
      if (!done.has(indices)) {
        done.add(indices);
        const index = indices.getArray().slice();
        for (let i = 0; i < index.length; i += 3) {
          const second = index[i + 1];
          index[i + 1] = index[i + 2];
          index[i + 2] = second;
        }
        indices.setArray(index);
      }
      triangles += indices.getCount() / 3;
    }
  }
  parts += 1;
}
// said once on the file, not on every part (1,396 notes would cost 180 kB decoded)
root.setExtras({ ...root.getExtras(), handedness: 'reflected x -> -x of the CAD frame (cad_pipeline/gtsio_layout.py EXPORT_MIRROR_X; docs/r10-handedness.md)' });
const out = await io.writeBinary(doc);
fs.writeFileSync(outFile, zlib.gzipSync(Buffer.from(out), { level: 9 }));
console.log(`${outFile}: ${parts} parts, ${triangles} triangles reflected, ${out.length} bytes decoded, sha256 ${crypto.createHash('sha256').update(out).digest('hex')}`);
