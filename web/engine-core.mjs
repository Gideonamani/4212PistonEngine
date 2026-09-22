// Load one model's geometry, apply a kinematics pose, render one frame.
// No orbit controls, no click-select, no section-cutting, no toolbar: this is the
// shared primitive behind Explore's full interactive viewer and Learn's live-lite
// model-pose slides. See docs/mode-shell-viewer-separation.md.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTransfer } from './transfer.mjs';
import { decodeModel } from './model-transport.mjs';
import { mechanismPose } from './kinematics.mjs';
import { valveMatrices } from './valve-transforms.mjs';

async function fetchModelBytes(url) {
  const transfer = createTransfer();
  let bytes;
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin', signal: transfer.signal });
    transfer.touch();
    if (!response.ok) throw Error(`HTTP ${response.status}: ${response.statusText}`);
    if (response.body) {
      const reader = response.body.getReader();
      const chunks = []; let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); received += value.byteLength; transfer.touch();
      }
      const joined = new Uint8Array(received); let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      bytes = joined.buffer;
    } else {
      bytes = await response.arrayBuffer();
    }
  } finally {
    transfer.finish();
  }
  return decodeModel(bytes, { signal: transfer.signal });
}

function groupMatrices(degrees, motionProfile) {
  const p = mechanismPose(degrees, motionProfile.radius_m, motionProfile.rod_length_m);
  return {
    Piston: new THREE.Matrix4().makeTranslation(...p.piston),
    ConnectingRod: new THREE.Matrix4().makeRotationZ(p.rodAngle).setPosition(...p.rod),
    Crank: new THREE.Matrix4().makeRotationZ(p.crankAngle),
    Cylinder: new THREE.Matrix4(),
  };
}

function fitCamera(camera, object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const distance = size / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.copy(center).add(new THREE.Vector3(1, .65, 1).normalize().multiplyScalar(distance * 1.3));
  camera.lookAt(center);
}

/**
 * Mount a minimal, non-interactive 3D view of one model into `container` at one pose.
 * @param {HTMLElement} container
 * @param {{assetUrl:string, assetFallbackUrl?:string, motionProfileUrl?:string, angle?:number}} options
 * @returns {Promise<{setPose(degrees:number):void, dispose():void, hasMotion:boolean}>}
 */
export async function createEngineCore(container, { assetUrl, assetFallbackUrl, motionProfileUrl, angle = 0 } = {}) {
  if (!assetUrl) throw Error('createEngineCore requires assetUrl');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101923');
  const camera = new THREE.PerspectiveCamera(40, 1, .001, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe5f5ff, 0x506070, 3));
  for (const [x, y, z] of [[2, 3, 4], [-3, 1, -2]]) {
    const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(x, y, z); scene.add(light);
  }

  function render() { renderer.render(scene, camera); }
  const resize = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(container);

  let bytes;
  try {
    bytes = await fetchModelBytes(assetUrl);
  } catch (e) {
    if (!assetFallbackUrl) throw e;
    bytes = await fetchModelBytes(assetFallbackUrl);
  }
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  const root = gltf.scene;
  const meshes = [];
  root.traverse(o => {
    if (o.isMesh) {
      let n = o, id;
      while (n && !id) { id = n.userData.cad_part_id; n = n.parent; }
      o.userData.partId = id;
      meshes.push(o);
    }
  });
  scene.add(root);
  fitCamera(camera, root);

  let motionProfile = null, motionEntries = [];
  if (motionProfileUrl) {
    const response = await fetch(motionProfileUrl);
    if (response.ok) {
      const profile = await response.json();
      if (!meshes.some(m => !profile.groups?.[m.userData.partId])) {
        motionProfile = profile;
        root.updateMatrixWorld(true);
        const bind = groupMatrices(profile.bind_angle_deg, profile);
        motionEntries = meshes.map(mesh => {
          const group = profile.groups[mesh.userData.partId];
          mesh.matrixAutoUpdate = false;
          return { mesh, group, localBind: bind[group].clone().invert().multiply(mesh.matrixWorld) };
        });
      }
    }
  }

  function setPose(degrees) {
    if (!motionProfile) { render(); return; }
    const transforms = groupMatrices(degrees, motionProfile);
    const valves = motionProfile.valves ? valveMatrices(degrees, motionProfile.valves) : null;
    for (const { mesh, group, localBind } of motionEntries) {
      const world = transforms[group].clone().multiply(localBind);
      const delta = valves?.matrices[mesh.userData.partId];
      if (delta) world.premultiply(delta);
      const spring = motionProfile.valves?.spring_targets?.[mesh.userData.partId];
      if (spring) mesh.morphTargetInfluences[mesh.morphTargetDictionary[spring.target]] = valves.cycle[spring.train + 'Lift'] / spring.maximum_lift_mm;
      mesh.matrix.copy(mesh.parent.matrixWorld).invert().multiply(world);
    }
    root.updateMatrixWorld(true);
    render();
  }

  setPose(angle);

  function dispose() {
    resize.disconnect();
    root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const mesh of meshes) {
      const material = mesh.material;
      (Array.isArray(material) ? material : [material]).forEach(m => m?.dispose?.());
    }
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { setPose, dispose, hasMotion: !!motionProfile };
}
