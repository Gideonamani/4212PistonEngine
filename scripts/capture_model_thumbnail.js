/*
 * Renders one of the app's 3D models to a PNG for a card thumbnail or an Explore gallery preview.
 *
 * Use: run `npm run dev`, open the app in a browser, paste this whole file into the DevTools console, then call
 * `captureModel(...)` (the calls that made the current images are in scripts/thumbnail_sources/captures.js). The PNG downloads, or
 * pass `onImage(dataUrl, filename)` to receive it instead. Save the image in scripts/thumbnail_sources/ and reference it from
 * web/thumbnails/sources.json; scripts/build_thumbnails.py then writes the final WebP files.
 *
 * Options: exposure (tone mapping, default 0.8), zoom (fraction of the fitted camera distance), pan ([x, y] in output pixels),
 * orbit ([azimuth, elevation] degrees), roll (degrees about the view axis, to lay a tall stack on its side), width/height (default 720 square), setup(session, runtime) to pose the model further,
 * e.g. choose a power path, and onImage.
 */
async function captureModel(modelId, name, view = {}, { exposure = 0.8, zoom = 1, pan = [0, 0], orbit = [0, 0], roll = 0, size = 720, width = size, height = size, setup, onImage } = {}) {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { createViewerRuntime } = await import('/src/viewer/core/runtime.ts');
  const { createModelSession } = await import('/src/viewer/adapters/index.ts');
  const { modelsById } = await import('/src/data/modelRegistry.ts');

  const mount = document.createElement('div');
  mount.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:99999;`;
  document.body.appendChild(mount);
  const runtime = createViewerRuntime(mount);
  const resize = () => {
    runtime.renderer.setPixelRatio(1);
    runtime.renderer.setSize(width, height, false);
    runtime.camera.aspect = width / height;
    runtime.camera.updateProjectionMatrix();
  };
  resize();
  const session = await createModelSession(modelsById[modelId], { runtime, profile: 'lesson-dynamic', signal: new AbortController().signal, onChange() {}, onProgress() {}, ...view });
  session.update?.(view);
  await setup?.(session, runtime);
  runtime.renderer.toneMappingExposure = exposure;

  const { camera, controls } = runtime;
  const target = controls.target.clone();
  if (orbit[0] || orbit[1]) {
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    spherical.theta += orbit[0] * Math.PI / 180;
    spherical.phi = Math.min(Math.PI - 0.1, Math.max(0.1, spherical.phi + orbit[1] * Math.PI / 180));
    camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));
  }
  const offset = camera.position.clone().sub(target).multiplyScalar(zoom);
  camera.position.copy(target).add(offset);
  controls.update();
  camera.updateMatrixWorld(true);
  // Screen-space pan in pixels of the final image.
  const perPixel = 2 * camera.position.distanceTo(controls.target) * Math.tan(camera.fov * Math.PI / 360) / height;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const move = right.multiplyScalar(-pan[0] * perPixel).add(up.multiplyScalar(pan[1] * perPixel));
  camera.position.add(move);
  controls.target.add(move);
  controls.update();
  if (roll) camera.rotateZ(roll * Math.PI / 180);

  await new Promise((resolve) => setTimeout(resolve, 800));
  resize();
  runtime.render();
  const dataUrl = runtime.renderer.domElement.toDataURL('image/png');
  if (onImage) await onImage(dataUrl, `${name}.png`);
  else {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${name}.png`;
    link.click();
  }
  session.dispose();
  runtime.dispose();
  mount.remove();
}
