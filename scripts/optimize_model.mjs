// Shrinks a teaching-model GLB without changing how it looks or how it is built, and proves it.
//
//   node scripts/optimize_model.mjs <in.glb|in.glb.gz> <out.glb> [--report report.json] [--gzip out.glb.gz]
//
// What changes, and what never does:
//   * Vertices are welded (bitwise-identical vertices merged) and reordered for the GPU cache: lossless. A fingerprint of every triangle's
//     corners (position, normal, texture coordinates, morph deltas), independent of vertex order, triangle order and which corner a triangle
//     starts at, is compared before and after.
//   * Accessors holding identical numbers are shared, which is what a modeller calls instancing: the six cylinders, the bolts and every other
//     repeated part were exported as separate identical copies. Each part keeps its own mesh, node, name and transform and still has its own
//     material; only the vertex and animation data underneath is stored once. The fingerprints are compared before and after this too.
//   * Positions keep their float32 form but are rounded to a 16-bit mantissa (about 2 micrometres on a 300 mm part): the rounded numbers
//     compress far better in the meshopt codec, and no node transform, name or hierarchy changes (integer position quantization would
//     insert correction nodes under the animated parts). The largest error is measured and must stay under MAX_POSITION_ERROR of the
//     model's size.
//   * Normals become 12-bit integers stored in 16-bit normalized form (KHR_mesh_quantization): at most about 0.03 degrees of direction error,
//     measured and bounded.
//   * Animation tracks drop keyframes that interpolation reproduces, keeping every other keyframe's time exactly; the values left are rounded
//     like positions. The resampler's tolerance is not a bound on the result (it drops keyframes greedily and the errors add up), so each
//     track is resampled again with a tighter tolerance until its measured error against the original, sampled at every original keyframe,
//     is within the limit.
//   * Everything is then packed with EXT_meshopt_compression (lossless), written, read back, and checked equal to what was meant to be written.
// Node names, hierarchy, transforms, materials, textures, morph targets and animation names are untouched.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { ready as resampleReady, resample as resampleWasm } from 'keyframe-resample';

export const DEFAULTS = Object.freeze({
  positionMantissaBits: 16,
  normalBits: 12,
  /** The resampler's starting tolerance; it is tightened per track until the measured error is within the limits below. */
  animationTolerance: 1e-5,
  animationMantissaBits: 16,
  /** How many times a track's tolerance is divided by four before giving up. */
  animationRetries: 6,
});

/** The most a position may move, as a fraction of the model's longest side. 1e-5 of a 300 mm engine is 3 micrometres. */
export const MAX_POSITION_ERROR = 1e-5;
/** The most a normal may turn, in degrees. */
export const MAX_NORMAL_ERROR_DEGREES = 0.1;
/** The most an animated translation may differ, as a fraction of the model's longest side (4.5 micrometres on a 45 mm part); a rotation, in degrees; a scale or morph weight, absolute. */
export const MAX_TRANSLATION_ERROR = 1e-4;
export const MAX_ROTATION_ERROR_DEGREES = 0.01;
export const MAX_SCALE_ERROR = 1e-4;
export const MAX_WEIGHT_ERROR = 1e-4;

const io = () => new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// --- fingerprints -----------------------------------------------------------------------------------------------------------------

function mix(hash, word) {
  let k = Math.imul(word | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  hash ^= k;
  hash = (hash << 13) | (hash >>> 19);
  return (Math.imul(hash, 5) + 0xe6546b64) | 0;
}

function finish(hash) {
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** Every attribute array of a primitive (and its morph targets) as 32-bit words, in a fixed order. */
function attributeWords(primitive) {
  const sources = [];
  const add = (accessor) => {
    const array = accessor.getArray();
    const floats = array instanceof Float32Array ? array : Float32Array.from(array);
    sources.push({ words: new Uint32Array(floats.buffer, floats.byteOffset, floats.length), size: accessor.getElementSize() });
  };
  for (const semantic of primitive.listSemantics().sort()) add(primitive.getAttribute(semantic));
  for (const target of primitive.listTargets()) for (const semantic of target.listSemantics().sort()) add(target.getAttribute(semantic));
  return sources;
}

/**
 * A fingerprint of a primitive's triangles that does not change when vertices are merged or reordered, triangles are reordered, or a
 * triangle's corners are rotated (which keeps its winding). Two primitives with equal fingerprints draw the same surface with the same data.
 */
export function triangleFingerprint(primitive) {
  const positions = primitive.getAttribute('POSITION');
  const indexAccessor = primitive.getIndices();
  const triangleCount = (indexAccessor ? indexAccessor.getCount() : positions.getCount()) / 3;
  const indices = indexAccessor ? indexAccessor.getArray() : undefined;
  const sources = attributeWords(primitive);
  const cornerHash = (vertex, seed) => {
    let hash = seed;
    for (const { words, size } of sources) for (let k = 0; k < size; k += 1) hash = mix(hash, words[vertex * size + k]);
    return hash;
  };
  const sums = [0, 0];
  const seeds = [0x9747b28c, 0x1234abcd];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const corners = indices
      ? [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]
      : [triangle * 3, triangle * 3 + 1, triangle * 3 + 2];
    for (let which = 0; which < 2; which += 1) {
      const hashes = corners.map((vertex) => cornerHash(vertex, seeds[which]));
      let best = Infinity;
      for (let rotation = 0; rotation < 3; rotation += 1) {
        let hash = seeds[which];
        for (let step = 0; step < 3; step += 1) hash = mix(hash, hashes[(rotation + step) % 3]);
        best = Math.min(best, finish(hash));
      }
      sums[which] += best;
    }
  }
  return `${triangleCount}:${sums[0]}:${sums[1]}`;
}

const fingerprints = (document) => document.getRoot().listMeshes().map((mesh) => mesh.listPrimitives().map(triangleFingerprint));

// --- the lossy steps, each measuring what it changed --------------------------------------------------------------------------------

/** Round float32 values to `keepBits` bits of mantissa, in place. Returns the largest absolute change. */
export function roundMantissa(array, keepBits) {
  const shift = 23 - keepBits;
  if (shift <= 0) return 0;
  const words = new Uint32Array(array.buffer, array.byteOffset, array.length);
  const half = 1 << (shift - 1);
  const mask = ~((1 << shift) - 1);
  let worst = 0;
  for (let index = 0; index < words.length; index += 1) {
    const before = array[index];
    if (!Number.isFinite(before) || before === 0) continue;
    words[index] = ((words[index] + half) & mask) >>> 0;
    worst = Math.max(worst, Math.abs(array[index] - before));
  }
  return worst;
}

/** Normals as 12-bit integers in 16-bit normalized storage. Returns the largest change in direction, in degrees. */
function quantizeNormals(accessor, bits) {
  const source = accessor.getArray();
  const scale = 2 ** (bits - 1) - 1; // 2047 for 12 bits
  const shift = 16 - bits; // low bits stay zero so the codec finds long runs
  const out = new Int16Array(source.length);
  let worst = 0;
  for (let index = 0; index < source.length; index += 3) {
    const length = Math.hypot(source[index], source[index + 1], source[index + 2]) || 1;
    const unit = [source[index] / length, source[index + 1] / length, source[index + 2] / length];
    const encoded = unit.map((component) => Math.round(component * scale));
    for (let k = 0; k < 3; k += 1) out[index + k] = encoded[k] * (1 << shift);
    const decodedLength = Math.hypot(...encoded) || 1;
    const dot = (encoded[0] * unit[0] + encoded[1] * unit[1] + encoded[2] * unit[2]) / decodedLength;
    worst = Math.max(worst, Math.acos(Math.min(1, dot)) * 180 / Math.PI);
  }
  accessor.setArray(out).setNormalized(true);
  return worst;
}

function evaluateTrack(times, values, size, path, interpolation, time) {
  let hi = 0;
  while (hi < times.length - 1 && times[hi] < time) hi += 1;
  if (times[hi] === time || hi === 0) return Array.from(values.subarray(hi * size, hi * size + size));
  const lo = hi - 1;
  if (interpolation === 'STEP') return Array.from(values.subarray(lo * size, lo * size + size));
  const t = (time - times[lo]) / (times[hi] - times[lo]);
  const a = values.subarray(lo * size, lo * size + size);
  const b = values.subarray(hi * size, hi * size + size);
  if (path === 'rotation') {
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const sign = dot < 0 ? -1 : 1;
    dot = Math.abs(dot);
    if (dot > 0.9995) return Array.from(a, (value, k) => value + t * (sign * b[k] - value));
    const theta = Math.acos(Math.min(1, dot));
    const wa = Math.sin((1 - t) * theta) / Math.sin(theta);
    const wb = sign * Math.sin(t * theta) / Math.sin(theta);
    return Array.from(a, (value, k) => wa * value + wb * b[k]);
  }
  return Array.from(a, (value, k) => value + t * (b[k] - value));
}

const rotationAngle = (a, b) => {
  const lengthA = Math.hypot(...a) || 1;
  const lengthB = Math.hypot(...b) || 1;
  const dot = Math.abs(a.reduce((sum, value, k) => sum + value * b[k], 0)) / (lengthA * lengthB);
  return 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
};

/** The worst disagreement between an original track and a new one, sampled at every original keyframe, in the units of its path (degrees for rotation). */
function trackError(before, times, values, path, interpolation) {
  const size = values.length / times.length;
  let worst = 0;
  for (let key = 0; key < before.times.length; key += 1) {
    const expected = Array.from(before.values.subarray(key * size, key * size + size));
    const actual = evaluateTrack(times, values, size, path, interpolation, before.times[key]);
    worst = Math.max(worst, path === 'rotation' ? rotationAngle(expected, actual) : Math.max(...expected.map((value, k) => Math.abs(value - actual[k]))));
  }
  return worst;
}

/** The worst disagreement between the original tracks and the new ones, by kind of track. */
function compareAnimation(original, document) {
  const result = { translation: 0, scale: 0, rotationDegrees: 0, weights: 0, keysBefore: 0, keysAfter: 0 };
  for (const animation of document.getRoot().listAnimations()) {
    const paths = new Map(animation.listChannels().map((channel) => [channel.getSampler(), channel.getTargetPath()]));
    for (const sampler of animation.listSamplers()) {
      const before = original.get(sampler);
      const path = paths.get(sampler);
      const times = sampler.getInput().getArray();
      result.keysBefore += before.times.length;
      result.keysAfter += times.length;
      const error = trackError(before, times, sampler.getOutput().getArray(), path, sampler.getInterpolation());
      const key = path === 'rotation' ? 'rotationDegrees' : path === 'translation' || path === 'scale' ? path : 'weights';
      result[key] = Math.max(result[key], error);
    }
  }
  return result;
}

/** The limit a track's measured error must stay within, in the units trackError reports. */
const limitFor = (path, size) => (path === 'rotation' ? MAX_ROTATION_ERROR_DEGREES : path === 'translation' ? MAX_TRANSLATION_ERROR * size : path === 'scale' ? MAX_SCALE_ERROR : MAX_WEIGHT_ERROR);

/** Drop the keyframes of one track that interpolation reproduces, tightening the resampler until the result is within the track's limit. */
function reduceTrack(sampler, path, before, size, settings) {
  const interpolation = sampler.getInterpolation();
  if (interpolation !== 'LINEAR' && interpolation !== 'STEP') return;
  const kind = interpolation === 'STEP' ? 'step' : path === 'rotation' ? 'slerp' : 'lerp';
  const limit = limitFor(path, size);
  let tolerance = settings.animationTolerance;
  for (let attempt = 0; attempt <= settings.animationRetries; attempt += 1, tolerance /= 4) {
    const times = Float32Array.from(before.times);
    const values = Float32Array.from(before.values);
    const count = resampleWasm(times, values, kind, tolerance);
    const dimension = values.length / before.times.length;
    const newTimes = times.slice(0, count);
    const newValues = values.slice(0, count * dimension);
    if (path !== 'weights') roundMantissa(newValues, settings.animationMantissaBits);
    if (trackError(before, newTimes, newValues, path, interpolation) <= limit) {
      sampler.setInput(sampler.getInput().clone().setArray(newTimes));
      sampler.setOutput(sampler.getOutput().clone().setArray(newValues));
      return;
    }
  }
  // Never reached the limit: keep this track exactly as it was.
}

function snapshotAnimation(document) {
  const original = new Map();
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      original.set(sampler, { times: Float32Array.from(sampler.getInput().getArray()), values: Float32Array.from(sampler.getOutput().getArray()) });
    }
  }
  return original;
}

/** The longest side of the model's bounding box, in the file's units, from every position accessor. */
function modelSize(document) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const array = primitive.getAttribute('POSITION').getArray();
    for (let index = 0; index < array.length; index += 3) for (let k = 0; k < 3; k += 1) {
      low[k] = Math.min(low[k], array[index + k]);
      high[k] = Math.max(high[k], array[index + k]);
    }
  }
  return Math.max(high[0] - low[0], high[1] - low[1], high[2] - low[2]) || 1;
}

const uniqueAccessors = (document, pick) => {
  const seen = new Set();
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) pick(primitive, (accessor) => accessor && seen.add(accessor));
  return [...seen];
};

// --- the whole pipeline ---------------------------------------------------------------------------------------------------------

export async function optimizeModel(inputBytes, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, resampleReady]);
  let bytes = inputBytes;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
  const document = await io().readBinary(new Uint8Array(bytes));
  const size = modelSize(document);
  const original = snapshotAnimation(document);
  const report = { sourceBytes: bytes.length, modelSize: size, settings };

  const countVertices = () => document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, prim) => sum + prim.getAttribute('POSITION').getCount(), 0);
  const countTriangles = () => document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, prim) => sum + (prim.getIndices() ?? prim.getAttribute('POSITION')).getCount() / 3, 0);
  report.verticesBefore = countVertices();
  report.triangles = countTriangles();

  // 1. Lossless: weld and reorder, then prove the surfaces are unchanged.
  const before = fingerprints(document);
  await document.transform(weld({ overwrite: true }), reorder({ encoder: MeshoptEncoder, target: 'size' }));
  const after = fingerprints(document);
  report.verticesAfter = countVertices();
  report.trianglesUnchanged = JSON.stringify(before) === JSON.stringify(after) && countTriangles() === report.triangles;
  if (!report.trianglesUnchanged) throw new Error('Welding or reordering changed the surface: a triangle fingerprint differs.');

  // 2. Normals to 12-bit integers.
  report.normalErrorDegrees = Math.max(0, ...uniqueAccessors(document, (primitive, add) => add(primitive.getAttribute('NORMAL'))).map((accessor) => quantizeNormals(accessor, settings.normalBits)));
  if (report.normalErrorDegrees > MAX_NORMAL_ERROR_DEGREES) throw new Error(`Normals moved ${report.normalErrorDegrees} degrees, over ${MAX_NORMAL_ERROR_DEGREES}.`);

  // 3. Positions (and morph position deltas) to a 16-bit mantissa.
  const positionAccessors = uniqueAccessors(document, (primitive, add) => {
    add(primitive.getAttribute('POSITION'));
    for (const target of primitive.listTargets()) add(target.getAttribute('POSITION'));
  });
  report.positionErrorAbsolute = Math.max(0, ...positionAccessors.map((accessor) => roundMantissa(accessor.getArray(), settings.positionMantissaBits)));
  report.positionErrorRelativeToModel = report.positionErrorAbsolute / size;
  if (report.positionErrorRelativeToModel > MAX_POSITION_ERROR) throw new Error(`Positions moved ${report.positionErrorRelativeToModel} of the model size, over ${MAX_POSITION_ERROR}.`);

  // 4. Animation: drop the keyframes interpolation reproduces, track by track, within each track's limit.
  if (document.getRoot().listAnimations().length) {
    for (const animation of document.getRoot().listAnimations()) {
      const paths = new Map(animation.listChannels().map((channel) => [channel.getSampler(), channel.getTargetPath()]));
      for (const sampler of animation.listSamplers()) reduceTrack(sampler, paths.get(sampler), original.get(sampler), size, settings);
    }
    const animation = compareAnimation(original, document);
    report.animation = { ...animation, translationRelativeToModel: animation.translation / size };
    if (animation.translation / size > MAX_TRANSLATION_ERROR || animation.rotationDegrees > MAX_ROTATION_ERROR_DEGREES || animation.scale > MAX_SCALE_ERROR || animation.weights > MAX_WEIGHT_ERROR) {
      throw new Error(`Animation changed beyond tolerance: ${JSON.stringify(report.animation)}`);
    }
  }

  // 5. Share identical data between parts (the surfaces must not change), animation inputs included.
  const surfacesBeforeSharing = fingerprints(document);
  report.accessorsBeforeSharing = document.getRoot().listAccessors().length;
  await document.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR], keepUniqueNames: true }));
  report.accessorsAfterSharing = document.getRoot().listAccessors().length;
  report.sharingKeptSurfaces = JSON.stringify(surfacesBeforeSharing) === JSON.stringify(fingerprints(document));
  if (!report.sharingKeptSurfaces) throw new Error('Sharing identical data changed a surface.');

  // 6. Pack, write, read back, compare.
  document.createExtension(KHRMeshQuantization).setRequired(true);
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const written = await io().writeBinary(document);
  const reread = await io().readBinary(written);
  report.roundTripExact = sameArrays(document, reread);
  if (!report.roundTripExact) throw new Error('The packed file does not decode to the data that was packed.');

  report.optimizedBytes = written.length;
  report.optimizedSha256 = crypto.createHash('sha256').update(written).digest('hex');
  const gzipped = zlib.gzipSync(written, { level: 9 });
  report.gzipBytes = gzipped.length;
  report.gzipSha256 = crypto.createHash('sha256').update(gzipped).digest('hex');
  report.sourceGzipBytes = zlib.gzipSync(bytes, { level: 9 }).length;
  return { glb: written, gzip: gzipped, report };
}

/** Every accessor of two documents holds the same numbers (triangle corners may rotate, which the index codec is allowed to do). */
function sameArrays(a, b) {
  const meshesA = a.getRoot().listMeshes();
  const meshesB = b.getRoot().listMeshes();
  if (meshesA.length !== meshesB.length) return false;
  for (let m = 0; m < meshesA.length; m += 1) {
    const primsA = meshesA[m].listPrimitives();
    const primsB = meshesB[m].listPrimitives();
    if (primsA.length !== primsB.length) return false;
    for (let p = 0; p < primsA.length; p += 1) {
      const semantics = primsA[p].listSemantics().sort();
      if (semantics.join() !== primsB[p].listSemantics().sort().join()) return false;
      for (const semantic of semantics) if (!sameValues(primsA[p].getAttribute(semantic), primsB[p].getAttribute(semantic))) return false;
      const targetsA = primsA[p].listTargets();
      const targetsB = primsB[p].listTargets();
      if (targetsA.length !== targetsB.length) return false;
      for (let t = 0; t < targetsA.length; t += 1) for (const semantic of targetsA[t].listSemantics()) if (!sameValues(targetsA[t].getAttribute(semantic), targetsB[t].getAttribute(semantic))) return false;
      if (triangleFingerprint(primsA[p]) !== triangleFingerprint(primsB[p])) return false;
    }
  }
  const animationsA = a.getRoot().listAnimations();
  const animationsB = b.getRoot().listAnimations();
  if (animationsA.length !== animationsB.length) return false;
  for (let index = 0; index < animationsA.length; index += 1) {
    const samplersA = animationsA[index].listSamplers();
    const samplersB = animationsB[index].listSamplers();
    if (samplersA.length !== samplersB.length || animationsA[index].getName() !== animationsB[index].getName()) return false;
    for (let s = 0; s < samplersA.length; s += 1) if (!sameValues(samplersA[s].getInput(), samplersB[s].getInput()) || !sameValues(samplersA[s].getOutput(), samplersB[s].getOutput())) return false;
  }
  return true;
}

function sameValues(x, y) {
  const a = x.getArray();
  const b = y.getArray();
  if (a.length !== b.length || x.getNormalized() !== y.getNormalized()) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

// --- command line -----------------------------------------------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: node scripts/optimize_model.mjs <in.glb|in.glb.gz> <out.glb> [--report report.json] [--gzip out.glb.gz]');
    process.exit(2);
  }
  const flag = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
  const { glb, gzip, report } = await optimizeModel(new Uint8Array(fs.readFileSync(input)));
  fs.writeFileSync(output, glb);
  if (flag('--gzip')) fs.writeFileSync(flag('--gzip'), gzip);
  if (flag('--report')) fs.writeFileSync(flag('--report'), `${JSON.stringify(report, null, 2)}\n`);
  const mb = (bytes) => (bytes / 1048576).toFixed(2);
  console.log(`${input}\n  decoded ${mb(report.sourceBytes)} -> ${mb(report.optimizedBytes)} MB; transfer (gzip) ${mb(report.sourceGzipBytes)} -> ${mb(report.gzipBytes)} MB`);
  console.log(`  vertices ${report.verticesBefore} -> ${report.verticesAfter} (merged), triangles ${report.triangles} unchanged: ${report.trianglesUnchanged}; accessors ${report.accessorsBeforeSharing} -> ${report.accessorsAfterSharing} once identical data is shared`);
  console.log(`  position error ${report.positionErrorAbsolute.toExponential(2)} (${(report.positionErrorRelativeToModel * 100).toExponential(2)}% of the model), normal error ${report.normalErrorDegrees.toFixed(4)} deg`);
  if (report.animation) console.log(`  animation keys ${report.animation.keysBefore} -> ${report.animation.keysAfter}; rotation error ${report.animation.rotationDegrees.toFixed(5)} deg, translation error ${(report.animation.translationRelativeToModel * 100).toExponential(2)}% of the model`);
  console.log(`  round trip exact: ${report.roundTripExact}; sha256 ${report.optimizedSha256}`);
}
