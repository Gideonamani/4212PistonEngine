import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {decodeModel} from './model-transport.mjs';

const $ = id => document.getElementById(id);
const say = text => { $('status').textContent = text; };
const progress = $('load-progress');
const view = $('view');
const lowMemoryDevice = Number(navigator.deviceMemory || 8) <= 4;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#101923');
const camera = new THREE.PerspectiveCamera(40, 1, .01, 250);
const renderer = new THREE.WebGLRenderer({antialias: !lowMemoryDevice, stencil: true, powerPreference: 'high-performance'});
renderer.localClippingEnabled = true;
renderer.setPixelRatio(Math.min(devicePixelRatio, lowMemoryDevice ? 1.25 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.append(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = .08;
scene.add(new THREE.HemisphereLight(0xe5f5ff, 0x506070, 3));
for (const position of [[2, 3, 4], [-3, 1, -2]]) {
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(...position);
  scene.add(light);
}

let contract;
let root;
let modelBox;
let clip;
let mixer;
let action;
let angle = 0;
let playing = false;
let lastFrame = 0;
let animationFrame = 0;
let selectedComponentId = '';
let isolatedComponentId = '';
let sectionFlipped = true;
let clippingActive = false;
let loadController;
let pointerDown;
const meshes = [];
const materials = new Set();
const componentIndex = new Map();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function render() {
  renderer.render(scene, camera);
}

orbit.addEventListener('change', render);
orbit.addEventListener('start', requestAnimation);
new ResizeObserver(() => {
  const {width, height} = view.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  render();
}).observe(view);

function setLoading(message, value = null) {
  say(message);
  progress.hidden = false;
  if (value === null) progress.removeAttribute('value');
  else progress.value = Math.max(0, Math.min(99, value));
}

function completeLoading(message) {
  progress.value = 100;
  progress.hidden = true;
  say(message);
}

function selectorMatches(item, selector) {
  const label = typeof item === 'string' ? item : item.label;
  return Boolean(selector?.all || selector?.any_regex?.some(pattern => new RegExp(pattern, 'i').test(label)));
}

// Stable glTF extras are the primary binding when an export provides them.
// This V5 release predates those extras, so selectors remain a deliberately
// bounded compatibility adapter rather than a second engine definition.
function bindingMatches(item, target) {
  const binding = target?.stable_binding || target?.binding;
  if (binding && Object.keys(item.binding).length) {
    return Object.entries(binding).every(([key, value]) => item.binding[key] === value);
  }
  return selectorMatches(item, target?.selector);
}

function groupById(id) {
  return contract.inspection_groups.find(group => group.id === id);
}

function componentById(id) {
  return componentIndex.get(id);
}

function componentMatchesGroup(component, groupId) {
  return groupId === 'all'
    || (groupId === 'cylinders' && component.group.startsWith('cylinder-'))
    || component.group === groupId;
}

function componentMatchesTerm(component, term) {
  const searchable = [component.label, component.description, ...(component.keywords || [])].join(' ').toLowerCase();
  return !term || searchable.includes(term);
}

function selectedComponent() {
  return componentById(selectedComponentId);
}

function isolatedComponent() {
  return componentById(isolatedComponentId);
}

function visibleByControl() {
  const group = groupById($('group').value);
  const isolated = isolatedComponent();
  for (const item of meshes) {
    item.mesh.visible = bindingMatches(item, group)
      && (!isolated || bindingMatches(item, isolated));
  }
  render();
}

function applyAppearance() {
  const inspection = $('appearance').value === 'inspection';
  const selected = selectedComponent();
  for (const item of meshes) {
    const highlighted = Boolean(selected && bindingMatches(item, selected));
    for (const material of item.materials) {
      if (inspection) {
        material.color.set(
          /Intake/i.test(item.label) ? 0x379e9b
            : /Exhaust/i.test(item.label) ? 0xbc7353
              : /V5 /i.test(item.label) ? 0x748694
                : /crank|gear|shaft/i.test(item.label) ? 0x596d80
                  : 0x9cabb8
        );
      } else {
        material.color.copy(material.userData.originalColor);
      }
      if (material.emissive) {
        material.emissive.set(highlighted ? 0x6c5100 : 0x000000);
        material.emissiveIntensity = highlighted ? .55 : 0;
      }
    }
  }
  render();
}

function frameBox(box, padding = 1.3) {
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const verticalDistance = size.y / (2 * Math.tan(halfFov));
  const horizontalDistance = size.x / (2 * Math.tan(halfFov) * Math.max(camera.aspect, .1));
  const distance = Math.max(verticalDistance, horizontalDistance, size.z) * padding;
  const direction = new THREE.Vector3(1.3, .8, 1.55).normalize();
  camera.near = Math.max(.01, distance / 100);
  camera.far = Math.max(250, distance * 20);
  camera.updateProjectionMatrix();
  orbit.minDistance = Math.max(.08, distance * .08);
  orbit.maxDistance = distance * 12;
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  orbit.update();
  render();
}

function frameItems(items) {
  root?.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const item of items) box.expandByObject(item.mesh);
  frameBox(box);
}

function updateComponentOptions() {
  const groupId = $('group').value;
  const term = $('search').value.trim().toLowerCase();
  const options = contract.teaching_components.filter(component => componentMatchesGroup(component, groupId) && componentMatchesTerm(component, term));
  const previous = selectedComponentId;
  $('parts').replaceChildren(
    new Option('Choose a teaching component…', ''),
    ...options.map(component => new Option(component.label, component.id))
  );
  if (options.some(component => component.id === previous)) $('parts').value = previous;
  else {
    selectedComponentId = '';
    isolatedComponentId = '';
  }
  $('matches').textContent = options.length
    ? `${options.length} teaching component${options.length === 1 ? '' : 's'} available.`
    : 'No teaching component matches that search.';
}

function selectComponent(id, {fromCanvas = false} = {}) {
  selectedComponentId = id;
  isolatedComponentId = '';
  $('parts').value = id;
  const component = selectedComponent();
  if (!component) {
    $('part-name').textContent = groupById($('group').value).label;
    $('part-function').textContent = 'Choose a teaching component to identify it before isolating it.';
  } else {
    $('part-name').textContent = component.label;
    $('part-function').textContent = component.description;
    if (fromCanvas) $('parts').focus({preventScroll: true});
  }
  visibleByControl();
  applyAppearance();
}

function resetInspection() {
  selectedComponentId = '';
  isolatedComponentId = '';
  $('group').value = 'all';
  $('search').value = '';
  resetSection();
  updateComponentOptions();
  visibleByControl();
  applyAppearance();
  $('part-name').textContent = 'Whole engine';
  $('part-function').textContent = 'Choose a teaching group, search the lesson components, or select a visible part.';
  frameBox(modelBox.clone());
}

function setMotion(value) {
  angle = (value % 720 + 720) % 720;
  if (mixer) mixer.setTime(clip.duration * angle / 720);
  $('motion-angle').value = String(angle);
  $('motion-value').textContent = `${angle.toFixed(0)}°`;
  const stroke = angle < 180 ? 'Power' : angle < 360 ? 'Exhaust' : angle < 540 ? 'Intake' : 'Compression';
  $('motion-note').textContent = `${stroke} stroke · all engine motion is sampled from the shared 720° action.`;
  render();
}

function pauseMotion() {
  playing = false;
  $('motion-play-label').textContent = 'Play';
  $('motion-play').setAttribute('aria-pressed', 'false');
}

function updateClipping(active) {
  if (active === clippingActive) return;
  clippingActive = active;
  for (const material of materials) {
    material.clippingPlanes = active ? [plane] : null;
    material.needsUpdate = true;
  }
}

function updateSection() {
  const active = $('section-enabled').checked;
  const axis = $('section-axis').value;
  const size = modelBox.getSize(new THREE.Vector3());
  const center = modelBox.getCenter(new THREE.Vector3());
  const normal = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  if (sectionFlipped) normal.negate();
  const position = Number($('section-position').value);
  const point = center.clone();
  point[axis] += size[axis] * .5 * (position - 50) / 50;
  plane.normal.copy(normal);
  plane.constant = -normal.dot(point);
  updateClipping(active);
  $('section-value').textContent = `${Math.round(position)}%`;
  $('section-flip').setAttribute('aria-pressed', String(sectionFlipped));
  render();
}

function resetSection() {
  sectionFlipped = true;
  $('section-enabled').checked = false;
  $('section-axis').value = 'z';
  $('section-position').value = '50';
  if (modelBox) updateSection();
}

function findComponentForMesh(item) {
  return contract.teaching_components
    .filter(component => bindingMatches(item, component))
    .sort((left, right) => JSON.stringify(right.selector).length - JSON.stringify(left.selector).length)[0];
}

function wireShell() {
  $('cycle-controls').hidden = false;
  $('cycle-enabled').checked = false;
  $('cycle-enabled').disabled = true;
  $('cycle-section').disabled = true;
  $('cycle-description').textContent = 'Gas-path cues are verified for the detailed cylinder model. This whole-engine model keeps the shared motion controls focused on its published drivetrain action.';
  $('load').hidden = true;
  $('cancel-load').hidden = true;
  $('drive').closest('details').hidden = true;

  $('group').replaceChildren(...contract.inspection_groups.map(group => new Option(group.label, group.id)));
  $('group').value = 'all';
  for (const id of ['group', 'search', 'parts', 'isolate', 'reset', 'appearance', 'motion-controls', 'section-controls', 'section-enabled', 'section-axis', 'section-position', 'section-flip']) {
    $(id).disabled = false;
  }

  $('group').onchange = () => {
    selectedComponentId = '';
    isolatedComponentId = '';
    updateComponentOptions();
    visibleByControl();
    applyAppearance();
    $('part-name').textContent = $('group').selectedOptions[0].textContent;
    $('part-function').textContent = 'Inspection group defined by the shared engine contract.';
    const group = groupById($('group').value);
    frameItems(meshes.filter(item => bindingMatches(item, group)));
  };
  $('search').oninput = updateComponentOptions;
  $('parts').onchange = () => selectComponent($('parts').value);
  $('isolate').onclick = () => {
    const component = selectedComponent();
    if (!component) {
      say('Choose a teaching component before isolating it.');
      return;
    }
    isolatedComponentId = component.id;
    visibleByControl();
    frameItems(meshes.filter(item => bindingMatches(item, component)));
    say(`Isolated ${component.label}. Use Show all to return to the complete engine.`);
  };
  $('reset').onclick = resetInspection;
  $('appearance').onchange = applyAppearance;

  $('motion-play').onclick = () => {
    playing = !playing;
    $('motion-play-label').textContent = playing ? 'Pause' : 'Play';
    $('motion-play').setAttribute('aria-pressed', String(playing));
    lastFrame = performance.now();
    if (playing) requestAnimation();
  };
  $('motion-reset').onclick = () => {
    pauseMotion();
    setMotion(0);
  };
  $('motion-angle').oninput = () => {
    pauseMotion();
    setMotion(Number($('motion-angle').value));
  };
  $('motion-preset').onchange = () => {
    if ($('motion-preset').value !== '') {
      pauseMotion();
      setMotion(Number($('motion-preset').value));
    }
  };

  $('section-enabled').onchange = updateSection;
  $('section-axis').onchange = updateSection;
  $('section-position').oninput = updateSection;
  $('section-flip').onclick = () => {
    sectionFlipped = !sectionFlipped;
    updateSection();
  };
  const explorer = $('explorer');
  const syncFullscreen = () => {
    const active = document.fullscreenElement === explorer || explorer.classList.contains('expanded');
    $('fullscreen-label').textContent = active ? 'Exit full screen' : 'Full screen';
    $('fullscreen').setAttribute('aria-pressed', String(active));
    $('fullscreen').title = active ? 'Exit full screen (Esc)' : 'Expand viewer';
    document.body.classList.toggle('viewer-expanded', active);
  };
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement === explorer) await document.exitFullscreen();
      else if (explorer.classList.contains('expanded')) explorer.classList.remove('expanded');
      else if (document.fullscreenEnabled && explorer.requestFullscreen) {
        try { await explorer.requestFullscreen(); }
        catch { explorer.classList.add('expanded'); }
      } else explorer.classList.add('expanded');
    } finally {
      syncFullscreen();
    }
  };
  document.addEventListener('fullscreenchange', syncFullscreen);
  $('toggle-controls').onclick = () => {
    const hidden = explorer.classList.toggle('controls-hidden');
    $('toggle-controls-label').textContent = hidden ? 'Show controls' : 'Hide controls';
    $('toggle-controls').setAttribute('aria-expanded', String(!hidden));
  };
}

const isGlb = bytes => bytes.byteLength >= 4 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
const formatMegabytes = bytes => `${(bytes / 1048576).toFixed(1)} MB`;

async function fetchAsset(url, signal, {compressed = false, transferBytes = 0, decodedBytes = 0} = {}) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw Error(`Could not download the engine model (${response.status}).`);
  if (!response.body) return {bytes: await response.arrayBuffer(), decodedByBrowser: false};

  const headerBytes = Number(response.headers.get('content-length')) || 0;
  const transferTotal = headerBytes || transferBytes;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let lastUpdate = 0;
  let decodedByBrowser = false;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      // Some browsers transparently decode a .gz response but keep the compressed
      // Content-Length header. Identify that stream from the GLB magic before
      // presenting progress, so received bytes never appear to exceed the download.
      if (compressed && received === value.byteLength) decodedByBrowser = isGlb(value);
      if (performance.now() - lastUpdate > 120) {
        const total = decodedByBrowser ? decodedBytes : transferTotal;
        const completePercent = total ? Math.min(96, Math.floor(received / total * 96)) : null;
        const stage = decodedByBrowser ? 'Unpacking full engine' : 'Downloading full engine';
        const totalText = total ? ` / ${formatMegabytes(total)}` : ' received';
        setLoading(`${stage}${completePercent === null ? '' : `: ${completePercent}%`} - ${formatMegabytes(received)}${totalText}`, completePercent);
        lastUpdate = performance.now();
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {bytes: bytes.buffer, decodedByBrowser};
}

async function loadAsset() {
  const transport = contract.asset.transport;
  const candidates = transport
    ? [
      {url: transport.web_url, compressed: transport.encoding === 'gzip', transferBytes: transport.bytes, decodedBytes: contract.asset.bytes},
      {url: transport.fallback_web_url, compressed: false, transferBytes: contract.asset.bytes, decodedBytes: contract.asset.bytes},
    ]
    : [{url: contract.asset.web_url, compressed: false, transferBytes: contract.asset.bytes, decodedBytes: contract.asset.bytes}];
  let lastError;
  for (const candidate of candidates) {
    try {
      setLoading(candidate.compressed ? 'Preparing compressed six-cylinder model...' : 'Preparing six-cylinder model...');
      const {bytes, decodedByBrowser} = await fetchAsset(candidate.url, loadController.signal, candidate);
      setLoading(decodedByBrowser ? 'Engine data received - validating geometry...' : candidate.compressed ? 'Download complete - unpacking engine geometry...' : 'Download complete - validating engine geometry...', 97);
      const decoded = await decodeModel(bytes, {
        signal: loadController.signal,
        onProgress: () => setLoading('Download complete - unpacking engine geometry...', 98),
      });
      return decoded;
    } catch (error) {
      lastError = error;
      if (loadController.signal.aborted) throw error;
      if (!candidate.compressed) break;
      setLoading('Compressed delivery is unavailable here - loading the compatible model...');
    }
  }
  throw lastError;
}

function requestAnimation() {
  if (!animationFrame) animationFrame = requestAnimationFrame(animate);
}

function animate(now) {
  animationFrame = 0;
  const settling = orbit.update();
  if (playing) {
    const elapsed = Math.max(0, Math.min(.1, (now - lastFrame) / 1000));
    lastFrame = now;
    setMotion(angle + elapsed * Number($('motion-speed').value));
  } else if (settling) {
    render();
  }
  if (playing || settling) requestAnimation();
}

renderer.domElement.addEventListener('pointerdown', event => {
  pointerDown = [event.clientX, event.clientY];
});
renderer.domElement.addEventListener('pointerup', event => {
  if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(meshes.filter(item => item.mesh.visible).map(item => item.mesh), false)[0];
  if (!hit) return;
  const item = meshes.find(candidate => candidate.mesh === hit.object);
  const component = item && findComponentForMesh(item);
  if (component) selectComponent(component.id, {fromCanvas: true});
});

async function load() {
  try {
    loadController = new AbortController();
    $('cancel-load').hidden = false;
    $('cancel-load').onclick = () => loadController?.abort();
    setLoading('Loading the six-cylinder engine lesson…');
    const model = globalThis.trainingModel || {};
    contract = await fetch(model.contract_url || './engine-contract.json').then(response => {
      if (!response.ok) throw Error('Engine contract unavailable');
      return response.json();
    });
    const bytes = await loadAsset();
    setLoading('Download complete · preparing six-cylinder engine controls…', 98);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    root = gltf.scene;
    scene.add(root);
    root.updateMatrixWorld(true);
    modelBox = new THREE.Box3().setFromObject(root);

    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const itemMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(source => {
        const material = source.clone();
        material.userData.originalColor = material.color.clone();
        materials.add(material);
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? itemMaterials : itemMaterials[0];
      const lineage = [];
      for (let node = mesh; node; node = node.parent) lineage.push(node.name || '');
      const binding = {};
      for (let node = mesh; node; node = node.parent) {
        for (const key of ['engine_id', 'module_id', 'instance_id']) {
          if (node.userData?.[key] !== undefined && binding[key] === undefined) binding[key] = node.userData[key];
        }
      }
      meshes.push({mesh, label: lineage.join(' / '), binding, materials: itemMaterials});
    });
    if (!meshes.length) throw Error('Published engine asset has no selectable geometry');

    clip = new THREE.AnimationClip('shared-engine-action', -1, gltf.animations.flatMap(animation => animation.tracks));
    if (!clip.tracks.length) throw Error('Published engine asset has no operation action');
    mixer = new THREE.AnimationMixer(root);
    action = mixer.clipAction(clip);
    // Motion is sampled with mixer.setTime(). A paused Three.js action ignores
    // those seeks, so keep it active while the UI controls the current angle.
    action.play();

    for (const component of contract.teaching_components) componentIndex.set(component.id, component);
    wireShell();
    updateComponentOptions();
    $('part-source').textContent = `Source scene: ${contract.source.scene}. Published asset: ${contract.asset.web_url}.`;
    $('part-evidence').textContent = 'V5 teaching reconstruction with contract-defined cylinder and drivetrain modules; inspect the model contract for validation scope.';
    setMotion(0);
    resetInspection();
    completeLoading(`Loaded six-cylinder engine · ${contract.teaching_components.length} teaching components. Drag to rotate, scroll or pinch to zoom.`);
    requestAnimation();
  } catch (error) {
    progress.hidden = true;
    if (error.name === 'AbortError') say('Engine download cancelled. Reload the page to try again.');
    else say(`Could not load the six-cylinder engine: ${error.message}`);
    console.error(error);
  } finally {
    $('cancel-load').hidden = true;
    loadController = undefined;
  }
}

load();
