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
 *
 * `frame: { dir: [x, y, z], fill }` replaces zoom, pan and orbit with the same framing for every model (the Explore gallery uses it, so
 * the tiles match): the camera looks along `dir`, and the visible geometry is centred and scaled to fill `fill` (default 0.8) of the
 * frame. `roll` still applies, to lay a tall stack on its side.
 *
 * The picture has a transparent background (`transparent: false` paints the dark stage instead): a card draws it over its own stage
 * colour, so the same file serves both themes. An X-ray spotlight is drawn with the 'neutral' palette (focus-style.mjs), a mid-tone ghost
 * that shows on either stage.
 */

/**
 * Centres the visible model in the frame and scales it to `fill`. It measures real vertices (a sample of them), not bounding boxes, and
 * skips hidden meshes, so a hidden helper or a scan with stray corners cannot shrink or shift the picture.
 */
function framePicture(THREE, runtime, { dir = [1, 0.6, 1], fill = 0.8, roll = 0 }) {
  const { scene, camera, controls } = runtime;
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    for (let node = object; node; node = node.parent) if (!node.visible) return;
    meshes.push(object);
  });
  const total = meshes.reduce((count, mesh) => count + mesh.geometry.attributes.position.count, 0);
  const step = Math.max(1, Math.ceil(total / 250000));
  const points = [];
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes.position;
    for (let index = 0; index < position.count; index += step) points.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
  }
  const box = new THREE.Box3().setFromPoints(points);
  const target = box.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(...dir).normalize();
  const rolled = roll * Math.PI / 180;
  let distance = box.getSize(new THREE.Vector3()).length() / 2 * 2.6;
  const place = () => {
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = Math.max(1200, distance * 20);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.up.set(0, 1, 0).applyAxisAngle(target.clone().sub(camera.position).normalize(), rolled);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };
  // Each pass moves the target to the middle of what is drawn and the camera to the distance at which it fills the frame.
  for (let pass = 0; pass < 8; pass++) {
    place();
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    for (const point of points) {
      const ndc = point.clone().project(camera);
      minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x); minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y);
    }
    const perNdc = distance * Math.tan(camera.fov * Math.PI / 360);
    target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), (minX + maxX) / 2 * perNdc)
      .addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), (minY + maxY) / 2 * perNdc);
    distance *= Math.max(maxX - minX, maxY - minY) / (2 * fill);
  }
  place();
  controls.target.copy(target);
}

async function captureModel(modelId, name, view = {}, { exposure = 0.8, zoom = 1, pan = [0, 0], orbit = [0, 0], roll = 0, size = 720, width = size, height = size, frame, setup, onImage, transparent = true } = {}) {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { createViewerRuntime } = await import('/src/viewer/core/runtime.ts');
  const { createModelSession } = await import('/src/viewer/adapters/index.ts');
  const { modelsById } = await import('/src/data/modelRegistry.ts');

  const mount = document.createElement('div');
  mount.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;z-index:99999;`;
  document.body.appendChild(mount);
  const runtime = createViewerRuntime(mount, { transparent });
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
  if (frame) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    framePicture(THREE, runtime, { roll, ...frame });
  } else {
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
  }

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
