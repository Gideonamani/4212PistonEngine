/*
 * Renders one of the app's 3D models to a square PNG for a card thumbnail.
 *
 * Use: run `npm run dev`, open the app in a browser, paste this whole file into the DevTools console, then call
 * `captureModel(...)` (examples below). The PNG downloads; convert it to WebP in scripts/thumbnail_sources/ and reference it from
 * web/thumbnails/sources.json as a "render" item, then run scripts/build_thumbnails.py.
 *
 * Renders currently in scripts/thumbnail_sources, and the calls that made them (720 px, tone-mapping exposure 0.8 unless noted):
 *   cylinder-operating-cycle  captureModel('cylinder', 'cylinder-operating-cycle', { initialAngle: 400, initialCycle: true }, { zoom: 0.85, pan: [-20, -5] })
 *   cylinder-exploded         captureModel('cylinder', 'cylinder-exploded', { savedMotionId: 'exploded', motionProgress: 60 }, { zoom: 0.64, pan: [-125, 12] })
 *   cylinder-course           captureModel('cylinder', 'cylinder-course', { initialAngle: 250, initialCycle: true }, { orbit: [-75, -12], zoom: 0.85 })
 *   gtsio520-full-engine      captureModel('gtsio520-h-v5-teaching-engine', 'gtsio520-full-engine', {}, { zoom: 0.8, pan: [-22, 12] })
 *   wright-1903-engine        captureModel('wright-1903-engine', 'wright-1903-engine', { viewPreset: 'engine-overview' }, { exposure: 0.5, zoom: 0.5, pan: [30, -20] })
 */
async function captureModel(modelId, name, view = {}, { exposure = 0.8, zoom = 1, pan = [0, 0], orbit = [0, 0], size = 720 } = {}) {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { createViewerRuntime } = await import('/src/viewer/core/runtime.ts');
  const { createModelSession } = await import('/src/viewer/adapters/index.ts');
  const { modelsById } = await import('/src/data/modelRegistry.ts');

  const mount = document.createElement('div');
  mount.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:99999;`;
  document.body.appendChild(mount);
  const runtime = createViewerRuntime(mount);
  const square = () => {
    runtime.renderer.setPixelRatio(1);
    runtime.renderer.setSize(size, size, false);
    runtime.camera.aspect = 1;
    runtime.camera.updateProjectionMatrix();
  };
  square();
  const session = await createModelSession(modelsById[modelId], { runtime, profile: 'lesson-dynamic', signal: new AbortController().signal, onChange() {}, onProgress() {}, ...view });
  session.update?.(view);
  runtime.renderer.toneMappingExposure = exposure;

  const { camera, controls } = runtime;
  const target = controls.target.clone();
  if (orbit[0] || orbit[1]) {
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    spherical.theta += orbit[0] * Math.PI / 180;
    spherical.phi = Math.min(Math.PI - 0.1, Math.max(0.1, spherical.phi + orbit[1] * Math.PI / 180));
    camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));
  }
  camera.position.copy(target).add(camera.position.clone().sub(target).multiplyScalar(zoom));
  controls.update();
  camera.updateMatrixWorld(true);
  // Screen-space pan in pixels of the final image.
  const perPixel = 2 * camera.position.distanceTo(controls.target) * Math.tan(camera.fov * Math.PI / 360) / size;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const move = right.multiplyScalar(-pan[0] * perPixel).add(up.multiplyScalar(pan[1] * perPixel));
  camera.position.add(move);
  controls.target.add(move);
  controls.update();

  await new Promise((resolve) => setTimeout(resolve, 800));
  square();
  runtime.render();
  const link = document.createElement('a');
  link.href = runtime.renderer.domElement.toDataURL('image/png');
  link.download = `${name}.png`;
  link.click();
  session.dispose();
  runtime.dispose();
  mount.remove();
}
