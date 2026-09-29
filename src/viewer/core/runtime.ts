import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { InteractionMode, ViewerRuntime } from '../types';

export function createViewerRuntime(container: HTMLElement): ViewerRuntime {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#071418');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.001, 1200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, alpha: false, powerPreference: 'high-performance' });
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.8;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI - 0.08;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdff9ff, 0x101c24, 0.85));
  for (const [color, intensity, position] of [
    [0xd9fbff, 1.8, [3, 4, 5]],
    [0x42eadb, 1.25, [-4, 1, 2]],
    [0xffa875, 0.8, [2, -2, -4]],
  ] as const) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(position[0], position[1], position[2]);
    scene.add(light);
  }

  let homePosition = new THREE.Vector3(2, 1, 2);
  let homeTarget = new THREE.Vector3();
  let homeObject: THREE.Object3D | undefined;
  let homeDirection = new THREE.Vector3(1, 0.62, 1);
  let homePadding: number | undefined;
  let pickTargets: THREE.Object3D[] = [];
  let onPick: ((object: THREE.Object3D, point: THREE.Vector3) => void) | undefined;
  let pointerDown: [number, number] | undefined;
  let animationCallback: ((elapsedSeconds: number) => boolean) | undefined;
  let animationFrame = 0;
  let previousFrame = performance.now();
  let disposed = false;

  const render = () => {
    if (!disposed) renderer.render(scene, camera);
  };

  const animate = (now: number) => {
    animationFrame = 0;
    const elapsed = Math.max(0, Math.min(0.1, (now - previousFrame) / 1000));
    previousFrame = now;
    if (animationCallback?.(elapsed)) {
      render();
      animationFrame = requestAnimationFrame(animate);
    }
  };

  const setAnimationCallback = (callback?: (elapsedSeconds: number) => boolean) => {
    animationCallback = callback;
    previousFrame = performance.now();
    if (callback && !animationFrame) animationFrame = requestAnimationFrame(animate);
    if (!callback && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  const fit = (object: THREE.Object3D, direction = new THREE.Vector3(1, 0.62, 1), padding = camera.aspect < 1 ? 1.18 : 1.08) => {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1));
    const distance = sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * padding;
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = Math.max(1200, distance * 20);
    camera.updateProjectionMatrix();
    controls.minDistance = Math.max(0.01, distance * 0.08);
    controls.maxDistance = distance * 12;
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction.clone().normalize(), distance);
    controls.update();
    homePosition = camera.position.clone();
    homeTarget = controls.target.clone();
    homeObject = object;
    homeDirection = direction.clone();
    homePadding = padding;
    render();
  };

  const focus = (target: THREE.Vector3, distance?: number) => {
    const direction = camera.position.clone().sub(controls.target).normalize();
    const radius = distance || Math.max(camera.position.distanceTo(controls.target) * 0.72, controls.minDistance * 1.4);
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, radius);
    controls.update();
    render();
  };

  const resetView = () => {
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
    render();
  };

  const setInteractionMode = (mode: InteractionMode) => {
    controls.mouseButtons.LEFT = mode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = mode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  };
  setInteractionMode('orbit');

  const setPickTargets = (objects: THREE.Object3D[], callback?: (object: THREE.Object3D, point: THREE.Vector3) => void) => {
    pickTargets = objects;
    onPick = callback;
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const handlePointerDown = (event: PointerEvent) => { pointerDown = [event.clientX, event.clientY]; };
  const handlePointerUp = (event: PointerEvent) => {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5 || !onPick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickTargets.filter((object) => object.visible), false)[0];
    if (hit) onPick(hit.object, hit.point);
  };
  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  renderer.domElement.addEventListener('pointerup', handlePointerUp);
  controls.addEventListener('change', render);

  const resize = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    const isAtHome = camera.position.distanceToSquared(homePosition) < 1e-8
      && controls.target.distanceToSquared(homeTarget) < 1e-8;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (isAtHome && homeObject) fit(homeObject, homeDirection, homePadding);
    else render();
  });
  resize.observe(container);

  return {
    scene,
    camera,
    renderer,
    controls,
    render,
    fit,
    focus,
    resetView,
    setInteractionMode,
    setPickTargets,
    setAnimationCallback,
    dispose() {
      disposed = true;
      resize.disconnect();
      setAnimationCallback(undefined);
      controls.removeEventListener('change', render);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
