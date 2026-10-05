// Draws an original model and its optimised version the same way and compares the pictures, so "it looks the same" is measured.
//
//   npm run dev        (in another terminal; the app's own dev server supplies three.js and the loader)
//   node scripts/compare_model_renders.mjs <original.glb[.gz]> <optimised.glb[.gz]> [label] [--record releases/model-optimization-opt1.json --model <id>]
//
// With --record and --model, the result is written into that model's entry of the release record.
//
// Each model is loaded with the app's loader, posed at three moments of its animation (if it has one) and drawn from three directions
// with the same camera and lights; the camera is fitted to the original so both are framed alike. For every picture the share of pixels
// that differ by more than 16 levels and the mean difference are reported. A model passes when no picture differs in more than 0.05% of
// its pixels or by more than 0.05 levels on average.

import fs from 'node:fs';
import zlib from 'node:zlib';
import { chromium } from '@playwright/test';

export const MAX_DIFFERING_PIXELS = 0.0005;
export const MAX_MEAN_DIFFERENCE = 0.05;
const BASE = process.env.APP_URL || 'http://localhost:5173';

const unpack = (file) => {
  const bytes = fs.readFileSync(file);
  return bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes) : bytes;
};

/** Runs inside the page: loads both models, renders the views and returns the measurements. */
const inPage = `(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { createGltfLoader } = await import('/src/viewer/core/gltf-loader.ts');
  const fetchBytes = async (url) => (await fetch(url)).arrayBuffer();
  const [originalBytes, optimisedBytes] = await Promise.all([fetchBytes('/__compare/original'), fetchBytes('/__compare/optimised')]);
  const size = 480;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setClearColor(0x071418, 1);

  async function pose(bytes, fraction, morphs) {
    const gltf = await createGltfLoader().parseAsync(bytes.slice(0), '');
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const longest = Math.max(0, ...gltf.animations.map((clip) => clip.duration));
    for (const clip of gltf.animations) mixer.clipAction(clip).play();
    mixer.setTime(longest * fraction);
    // With morphs on, every morph target (a spring's compression, say) is pushed to full strength, which the animation may never reach.
    if (morphs) gltf.scene.traverse((object) => { if (object.morphTargetInfluences) object.morphTargetInfluences.fill(1); });
    gltf.scene.updateMatrixWorld(true);
    return { gltf, longest };
  }

  function draw(gltf, camera) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.copy(camera.position);
    scene.add(light, gltf.scene);
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    scene.remove(gltf.scene);
    return pixels;
  }

  // How long the app's loader takes to turn each file's bytes into a scene: the best of three, in this browser on this machine (desktop
  // Chrome; a phone is slower, but the comparison between the two files carries over).
  async function timeParse(bytes) {
    const times = [];
    for (let run = 0; run < 3; run += 1) {
      const start = performance.now();
      await createGltfLoader().parseAsync(bytes.slice(0), '');
      times.push(performance.now() - start);
    }
    return Math.min(...times);
  }
  const timing = { originalMs: await timeParse(originalBytes), optimisedMs: await timeParse(optimisedBytes) };

  const results = [];
  for (const [fraction, morphs] of [[0, false], [0.37, false], [0.8, false], [0, true]]) {
    const a = await pose(originalBytes, fraction, morphs);
    const b = await pose(optimisedBytes, fraction, morphs);
    const box = new THREE.Box3().setFromObject(a.gltf.scene);
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    for (const [name, direction] of [['iso', [1, 0.8, 1.2]], ['front', [0, 0.1, 1]], ['top', [0.2, 1, 0.1]]]) {
      const camera = new THREE.PerspectiveCamera(35, 1, radius / 50, radius * 20);
      camera.position.copy(centre).add(new THREE.Vector3(...direction).normalize().multiplyScalar(radius * 2.6));
      camera.lookAt(centre);
      camera.updateMatrixWorld(true);
      const first = draw(a.gltf, camera);
      const second = draw(b.gltf, camera);
      let differing = 0, total = 0, worst = 0, covered = 0;
      for (let index = 0; index < first.length; index += 4) {
        const d = Math.max(Math.abs(first[index] - second[index]), Math.abs(first[index + 1] - second[index + 1]), Math.abs(first[index + 2] - second[index + 2]));
        total += d; worst = Math.max(worst, d);
        if (d > 16) differing += 1;
        if (first[index] !== 7 || first[index + 1] !== 20 || first[index + 2] !== 24) covered += 1;
      }
      const pixelCount = first.length / 4;
      results.push({ view: name, atFraction: morphs ? 'morphs on' : fraction, differingPixels: differing / pixelCount, meanDifference: total / pixelCount, worstDifference: worst, modelPixels: covered / pixelCount });
    }
    a.gltf.scene.traverse((o) => { o.geometry?.dispose(); });
    b.gltf.scene.traverse((o) => { o.geometry?.dispose(); });
  }
  renderer.dispose();
  return { results, timing };
})()`;

/** @returns {Promise<{ results: object[], timing: { originalMs: number, optimisedMs: number } }>} */
export async function compareModels(originalFile, optimisedFile) {
  const originalBytes = unpack(originalFile);
  const optimisedBytes = unpack(optimisedFile);
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
    page.on('pageerror', (error) => console.error('page error:', error.message));
    await page.route('**/__compare/original', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: originalBytes }));
    await page.route('**/__compare/optimised', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: optimisedBytes }));
    await page.goto(`${BASE}/#/explore`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.locator('h1, h2, h3').first().waitFor({ timeout: 120_000 });
    return await page.evaluate(inPage);
  } finally {
    await browser.close();
  }
}

export const passes = (results) => results.every((entry) => entry.differingPixels <= MAX_DIFFERING_PIXELS && entry.meanDifference <= MAX_MEAN_DIFFERENCE);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const args = process.argv.slice(2);
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const [original, optimised, maybeLabel] = args.filter((value, index) => !value.startsWith('--') && !(index > 0 && args[index - 1].startsWith('--')));
  const label = maybeLabel ?? optimised;
  if (!original || !optimised) {
    console.error('usage: node scripts/compare_model_renders.mjs <original.glb[.gz]> <optimised.glb[.gz]> [label]');
    process.exit(2);
  }
  const { results, timing } = await compareModels(original, optimised);
  console.log(label);
  for (const entry of results) {
    console.log(`  ${entry.view.padEnd(5)} at ${String(entry.atFraction).padEnd(9)} model ${(entry.modelPixels * 100).toFixed(0).padStart(3)}% of frame, differing pixels ${(entry.differingPixels * 100).toFixed(4)}%, mean difference ${entry.meanDifference.toFixed(4)}, worst ${entry.worstDifference}`);
  }
  const ok = passes(results);
  console.log(`  parse time ${timing.originalMs.toFixed(0)} ms -> ${timing.optimisedMs.toFixed(0)} ms (best of 3, desktop Chrome)`);
  console.log(ok ? '  SAME: every view is within the limits' : '  DIFFERENT: a view is over the limits');
  if (flag('--record') && flag('--model')) {
    const record = JSON.parse(fs.readFileSync(flag('--record'), 'utf8'));
    const entry = record.models.find((model) => model.id === flag('--model'));
    if (!entry) throw new Error(`No model ${flag('--model')} in ${flag('--record')}`);
    entry.renderCheck = {
      checkedOn: new Date().toISOString().slice(0, 10),
      pictures: results.length,
      worstDifferingPixels: Math.max(...results.map((entry) => entry.differingPixels)),
      worstMeanDifference: Math.max(...results.map((entry) => entry.meanDifference)),
      limits: { differingPixels: MAX_DIFFERING_PIXELS, meanDifference: MAX_MEAN_DIFFERENCE },
      passed: ok,
    };
    entry.parseTime = { originalMs: Math.round(timing.originalMs), optimisedMs: Math.round(timing.optimisedMs), runs: 3, where: 'desktop Chrome, best of three, app loader' };
    fs.writeFileSync(flag('--record'), `${JSON.stringify(record, null, 2)}
`);
  }
  process.exit(ok ? 0 : 1);
}
