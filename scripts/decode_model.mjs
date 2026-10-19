// Unpack a meshopt-compressed teaching-model GLB into a plain GLB, so the Python audit tools (which read raw buffers) can open it.
//
//   node scripts/decode_model.mjs <in.glb|in.glb.gz> <out.glb>
//
// scripts/optimize_model.mjs packs models with EXT_meshopt_compression, which is lossless: this writes exactly the numbers the packed file
// decodes to (the viewer decodes the same way). Positions stay float32; normals stay 16-bit normalized (KHR_mesh_quantization), which the
// audit does not read. A file that is not compressed is written out unchanged in meaning.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

export async function decodeModel(bytes) {
  await MeshoptDecoder.ready;
  let input = bytes;
  if (input[0] === 0x1f && input[1] === 0x8b) input = zlib.gunzipSync(input);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const document = await io.readBinary(new Uint8Array(input));
  for (const extension of document.getRoot().listExtensionsUsed()) if (extension.extensionName === EXTMeshoptCompression.EXTENSION_NAME) extension.dispose();
  return io.writeBinary(document);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: node scripts/decode_model.mjs <in.glb|in.glb.gz> <out.glb>');
    process.exit(2);
  }
  const decoded = await decodeModel(new Uint8Array(fs.readFileSync(input)));
  fs.writeFileSync(output, decoded);
  console.log(`${output}: ${decoded.length} bytes, sha256 ${crypto.createHash('sha256').update(decoded).digest('hex')}`);
}
