// Pose an animated-study model through the app's own procedural sampler and write each part's world matrix to a JSON file.
//
// The R10 mechanism study has no baked clips: the viewer computes the core cycle and the exploded layout in the browser, from the
// contract, with createProceduralStudySampler(). scripts/audit_assembly_interference.py cannot reach those poses by reading the GLB,
// so this tool replays the sampler outside the browser and hands the poses to scripts/audit_procedural_poses.py.
//
//   node scripts/sample_animated_study_poses.mjs web/gtsio520-r10-static.glb.gz web/gtsio520-r10-contract.json \
//        --cycle-step 10 --explode-fractions 0.09,0.18,0.27,0.36,0.47,0.58,0.69,0.8,0.9,1 --out build/poses.json
//
// Poses written: "rest" (the assembled GLB as exported, every part, used to cross-check the Python reading of the file), the core
// cycle at every `--cycle-step` crank degrees from 0 up to (not including) 720 plus any `--cycle-angles`, and the explosion at the
// given fractions of its 12 s clip (the collapse clip replays the same layouts in reverse). For each pose only the parts whose
// world matrix differs from rest are stored. The 4x4 matrices are column-major as Three.js holds them, in glTF metres.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createProceduralStudySampler, indexStudyParts} from '../src/viewer/core/animated-study-motion.mjs';

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
if (positional.length < 2) {
  console.error('usage: sample_animated_study_poses.mjs <model.glb[.gz]> <contract.json> [--cycle-step deg] [--cycle-angles a,b] [--explode-fractions f,f] [--out file]');
  process.exit(2);
}
const [modelPath, contractPath] = positional;
const out = path.resolve(option('out', 'build/animated-study-poses.json'));
const cycleStep = Number(option('cycle-step', 0));
const cycleAngles = (option('cycle-angles', '') || '').split(',').filter(Boolean).map(Number);
const explodeFractions = (option('explode-fractions', '') || '').split(',').filter(Boolean).map(Number);

let raw = fs.readFileSync(modelPath);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
const root = gltf.scene;
const {partsById} = indexStudyParts(root);
root.updateMatrixWorld(true);
const rest = new Map([...partsById].map(([id, o]) => [id, o.matrixWorld.clone()]));
const sampler = createProceduralStudySampler(contract, partsById, root);
const motion = (type) => contract.motions.find((m) => m.procedural?.type === type);
const cycle = motion('gtsio-core-cycle'), explode = motion('explode'), collapse = motion('collapse');

const near = (a, b) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-12);
function snapshot(label, kind, extra) {
  const world = {};
  for (const [id, o] of partsById) if (!near(o.matrixWorld, rest.get(id))) world[id] = [...o.matrixWorld.elements];
  return {label, kind, ...extra, moved_parts: Object.keys(world).length, world};
}

const poses = [];
// The rest pose lists every part, so the auditor can prove it reads the file the same way Three.js does.
poses.push({label: 'rest', kind: 'rest', moved_parts: 0, world: {}, all_parts: Object.fromEntries([...rest].map(([id, m]) => [id, [...m.elements]]))});

const angles = new Set(cycleAngles);
if (cycleStep > 0) for (let a = 0; a < 720 - 1e-9; a += cycleStep) angles.add(Number(a.toFixed(6)));
for (const angle of [...angles].sort((a, b) => a - b)) {
  sampler.apply(cycle, (angle / 720) * 100);
  poses.push(snapshot(`cycle @ ${angle} deg`, 'cycle', {crank_deg: angle}));
}
for (const f of explodeFractions) {
  sampler.apply(explode, f * 100);
  poses.push(snapshot(`explode @ ${f}`, 'explode', {fraction: f}));
}
sampler.restoreRest();

fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify({
  asset_sha256: createHash('sha256').update(raw).digest('hex'),
  asset_bytes: raw.length,
  contract: path.relative(process.cwd(), path.resolve(contractPath)).replaceAll('\\', '/'),
  sampler: 'src/viewer/core/animated-study-motion.mjs createProceduralStudySampler (apply(motion, progress 0-100); cycle angle = progress x 7.2)',
  parts: partsById.size,
  poses,
}));
console.log(`${poses.length} poses, ${partsById.size} parts -> ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
