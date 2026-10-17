import * as THREE from 'three';

const INCH = 25.4;
const THROW = 2 * INCH;
const ROD_LENGTH = 6.625 * INCH;
const FIRING_ORDER = [1, 4, 5, 2, 3, 6];
const FIRING_PHASE = Object.fromEntries(FIRING_ORDER.map((n, k) => [n, k * 120]));
const MAIN_WIDTH = 44;
const CHEEK_WIDTH = 26;
const PIN_WIDTH = 30;
const BAY_PITCH = 3 * CHEEK_WIDTH + 2 * PIN_WIDTH + MAIN_WIDTH;

const PIVOT_T = 132;
const PIVOT_U = -44;
const CUP_T = 115;
const CUP_U = -72;
const SPRING_TOP = 110;
const SPRING_INSTALLED = 45;
const BASE_RADIUS = 19.5;
const CAM_LIFT = 6;
const HALF_EVENT = (70 * Math.PI) / 180;
const SOCKET_OFFSET = 45;
const PAD_RADIUS = 6.5;
const DEFAULT_STAGE_ENDS = [0, 0.18, 0.36, 0.58, 0.80, 1.0];

// CAD (X right, Y up, Z forward) -> glTF (X right, Y = CAD Z, Z = -CAD Y)
const CAD_TO_GLTF = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
);
const GLTF_TO_CAD = CAD_TO_GLTF.clone().invert();

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unit3 = (a) => scale3(a, 1 / Math.hypot(a[0], a[1], a[2]));

function rotateVec3(p, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), d = dot3(axis, p) * (1 - c);
  const [x, y, z] = axis, [u, v, w] = p;
  return [
    u * c + (y * w - z * v) * s + x * d,
    v * c + (z * u - x * w) * s + y * d,
    w * c + (x * v - y * u) * s + z * d,
  ];
}

function eye4() {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function mul4(a, b) {
  const out = eye4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] + a[i][3] * b[3][j];
    }
  }
  return out;
}

function trans4(v) {
  return [
    [1, 0, 0, v[0]],
    [0, 1, 0, v[1]],
    [0, 0, 1, v[2]],
    [0, 0, 0, 1],
  ];
}

function rotation4(axis, angle) {
  const [x, y, z] = unit3(axis);
  const c = Math.cos(angle), s = Math.sin(angle), d = 1 - c;
  return [
    [c + x * x * d, x * y * d - z * s, x * z * d + y * s, 0],
    [y * x * d + z * s, c + y * y * d, y * z * d - x * s, 0],
    [z * x * d - y * s, z * y * d + x * s, c + z * z * d, 0],
    [0, 0, 0, 1],
  ];
}

function around4(axis, angle, pivot) {
  return mul4(mul4(trans4(pivot), rotation4(axis, angle)), trans4(scale3(pivot, -1)));
}

function align4(a, b) {
  const ua = unit3(a), ub = unit3(b);
  const cross = [
    ua[1] * ub[2] - ua[2] * ub[1],
    ua[2] * ub[0] - ua[0] * ub[2],
    ua[0] * ub[1] - ua[1] * ub[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]);
  return length > 1e-12 ? rotation4(scale3(cross, 1 / length), Math.atan2(length, dot3(ua, ub))) : eye4();
}

function cadMmMatrixToGltfThree(m) {
  return new THREE.Matrix4().set(
    m[0][0], m[0][1], m[0][2], m[0][3] / 1000,
    m[1][0], m[1][1], m[1][2], m[1][3] / 1000,
    m[2][0], m[2][1], m[2][2], m[2][3] / 1000,
    0, 0, 0, 1,
  ).premultiply(CAD_TO_GLTF).multiply(GLTF_TO_CAD);
}

export function stationMm(n) {
  const bay = Math.floor((n - 1) / 2);
  const index = (n - 1) % 2;
  return MAIN_WIDTH + bay * BAY_PITCH + CHEEK_WIDTH + PIN_WIDTH / 2 + index * (PIN_WIDTH + CHEEK_WIDTH);
}

export function sliderCrankPoseMm(n, theta = 0) {
  const sign = n % 2 ? 1 : -1;
  const angle = ((theta - FIRING_PHASE[n] + (sign === 1 ? 0 : 180)) * Math.PI) / 180;
  const z = stationMm(n);
  const pin = [THROW * Math.cos(angle), THROW * Math.sin(angle), z];
  const wrist = [sign * (Math.sqrt(ROD_LENGTH * ROD_LENGTH - pin[1] * pin[1]) + sign * pin[0]), 0, z];
  const dx = wrist[0] - pin[0], dy = wrist[1] - pin[1];
  return { pin, wrist, rod_roll: (Math.atan2(-dx, dy) * 180) / Math.PI, sign };
}

function rawFrame(name, params) {
  const side = name === 'Intake' ? -1 : 1;
  const key = `${name.toLowerCase()}_angle`;
  const angle = (side * params[key] * Math.PI) / 180;
  const d = [Math.cos(angle), 0, Math.sin(angle)];
  const v = [-d[2], 0, d[0]];
  return { base: [params.head_seat, 0, side * params.valve_offset], d, v };
}

function rawPoint(name, t, u, w, params) {
  const { base, d, v } = rawFrame(name, params);
  return [
    base[0] + d[0] * t + v[0] * w,
    base[1] + d[1] * t + u + v[1] * w,
    base[2] + d[2] * t + v[2] * w,
  ];
}

function worldPoint(name, n, t, u, w, params) {
  let [x, y, z] = rawPoint(name, t, u, w, params);
  z = -z;
  if (n % 2 === 0) { x = -x; z = -z; }
  return [x, y, z + stationMm(n)];
}

function worldVector(vec, n) {
  const sign = n % 2 ? 1 : -1;
  return [sign * vec[0], vec[1], -sign * vec[2]];
}

function followerStation(name, n) {
  if (name === 'Intake') {
    const odd = n % 2 ? n : n - 1;
    return (stationMm(odd) + stationMm(odd + 1)) / 2;
  }
  return stationMm(n) + (n % 2 ? -17 : 17);
}

function liftLaw(angle) {
  const twoPi = 2 * Math.PI;
  const x = (((angle + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  if (Math.abs(x) >= HALF_EVENT) return 0;
  const k = Math.PI / HALF_EVENT;
  return (CAM_LIFT * (1 + Math.cos(k * x))) / 2;
}

function lobePhase(name, n, camRate) {
  const lobeCyl = name === 'Intake' ? (n % 2 ? n : n - 1) : n;
  const peak = name === 'Intake' ? 450 : 270;
  const raw = (lobeCyl % 2 ? 0 : Math.PI) - camRate * (((FIRING_PHASE[lobeCyl] + peak) * Math.PI) / 180);
  const twoPi = 2 * Math.PI;
  return ((raw % twoPi) + twoPi) % twoPi;
}

function valvePoseMm(name, n, params, theta = 0) {
  const camRate = params.cam_rate ?? -0.5;
  const sign = n % 2 ? 1 : -1;
  const gamma = sign > 0 ? 0 : Math.PI;
  const phase = lobePhase(name, n, camRate);
  const rise = liftLaw(gamma - phase - camRate * ((theta * Math.PI) / 180));
  const a0 = [sign * (BASE_RADIUS + SOCKET_OFFSET), params.case_cam_y, followerStation(name, n)];
  const a = [a0[0] + sign * rise, a0[1], a0[2]];
  const b0 = worldPoint(name, n, CUP_T, CUP_U, 0, params);
  const length = dist3(a0, b0);
  const { base, d, v } = rawFrame(name, params);
  const pivot = rawPoint(name, PIVOT_T, PIVOT_U, 0, params);
  const cup = rawPoint(name, CUP_T, CUP_U, 0, params);
  const toWorld = (p) => {
    let [x, y, z] = p;
    z = -z;
    if (sign < 0) { x = -x; z = -z; }
    return [x, y, z + stationMm(n)];
  };
  const rawCup = (beta) => add3(pivot, rotateVec3(sub3(cup, pivot), v, beta));
  let beta = 0;
  if (rise > 1e-12) {
    let lo = 0, hi = 0.6;
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      if (dist3(a, toWorld(rawCup(mid))) < length) lo = mid;
      else hi = mid;
    }
    beta = (lo + hi) / 2;
  }
  const tip = params[`${name.toLowerCase()}_valve_length`] - 3;
  const pad0 = rawPoint(name, tip + PAD_RADIUS, 0, 0, params);
  const pad = add3(pivot, rotateVec3(sub3(pad0, pivot), v, beta));
  const centreT = dot3(sub3(pad, base), d);
  const valveLift = tip - (centreT - PAD_RADIUS);
  return { socket: a, cup: toWorld(rawCup(beta)), beta, valve_lift: valveLift };
}

export function createGtsioBodyEvaluator(parameters = {}) {
  const params = {
    case_cam_y: -78.0,
    head_seat: 157.0,
    valve_offset: 25.0,
    intake_angle: 18.0,
    exhaust_angle: 20.0,
    intake_valve_length: 124.206,
    exhaust_valve_length: 124.714,
    cam_rate: -0.5,
    ...parameters,
  };
  const closedValves = new Map();
  for (const name of ['Intake', 'Exhaust']) {
    for (let n = 1; n <= 6; n++) {
      closedValves.set(`${name}${n}`, valvePoseMm(name, n, params, 0));
    }
  }
  const closedCrank = {};
  for (let n = 1; n <= 6; n++) closedCrank[n] = sliderCrankPoseMm(n, 0);

  return function evaluateBodyGltfMatrix(body, theta) {
    if (!body || body.startsWith('fixed:')) return new THREE.Matrix4();
    if (body === 'crank') {
      return cadMmMatrixToGltfThree(around4([0, 0, 1], (theta * Math.PI) / 180, [0, 0, 0]));
    }
    if (body === 'cam') {
      return cadMmMatrixToGltfThree(around4([0, 0, 1], ((theta * Math.PI) / 180) * params.cam_rate, [0, params.case_cam_y, 0]));
    }
    if (body.startsWith('rod')) {
      const n = Number(body.slice(-1));
      const a = closedCrank[n], b = sliderCrankPoseMm(n, theta);
      const m = mul4(mul4(trans4(b.pin), rotation4([0, 0, 1], ((b.rod_roll - a.rod_roll) * Math.PI) / 180)), trans4(scale3(a.pin, -1)));
      return cadMmMatrixToGltfThree(m);
    }
    if (body.startsWith('piston')) {
      const n = Number(body.slice(-1));
      const a = closedCrank[n], b = sliderCrankPoseMm(n, theta);
      return cadMmMatrixToGltfThree(trans4(sub3(b.wrist, a.wrist)));
    }
    const colon = body.indexOf(':');
    if (colon < 0) return new THREE.Matrix4();
    const kind = body.slice(0, colon);
    const tag = body.slice(colon + 1);
    const match = /^(Intake|Exhaust)([1-6])$/.exec(tag);
    if (!match) return new THREE.Matrix4();
    const [, name, numStr] = match;
    const n = Number(numStr);
    const a = closedValves.get(tag);
    const b = valvePoseMm(name, n, params, theta);
    if (kind === 'lifter') {
      return cadMmMatrixToGltfThree(trans4(sub3(b.socket, a.socket)));
    }
    if (kind === 'valve') {
      const direction = worldVector(rawFrame(name, params).d, n);
      return cadMmMatrixToGltfThree(trans4(scale3(direction, -(b.valve_lift - a.valve_lift))));
    }
    if (kind === 'rocker') {
      const axis = scale3(worldVector(rawFrame(name, params).v, n), -1);
      const pivot = worldPoint(name, n, PIVOT_T, PIVOT_U, 0, params);
      return cadMmMatrixToGltfThree(around4(axis, b.beta - a.beta, pivot));
    }
    if (kind === 'pushrod') {
      const m = mul4(mul4(trans4(b.socket), align4(sub3(a.cup, a.socket), sub3(b.cup, b.socket))), trans4(scale3(a.socket, -1)));
      return cadMmMatrixToGltfThree(m);
    }
    if (kind === 'spring') {
      const scale = (SPRING_INSTALLED - b.valve_lift) / (SPRING_INSTALLED - a.valve_lift);
      const axis = worldVector(rawFrame(name, params).d, n);
      const m = eye4();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) m[i][j] += (scale - 1) * axis[i] * axis[j];
      }
      const foot = worldPoint(name, n, SPRING_TOP - SPRING_INSTALLED, 0, 0, params);
      return cadMmMatrixToGltfThree(mul4(mul4(trans4(foot), m), trans4(scale3(foot, -1))));
    }
    return new THREE.Matrix4();
  };
}

/** Build an O(1) Map<partId, THREE.Mesh> alongside the ordered mesh array. */
export function indexStudyParts(root) {
  const meshes = [];
  const partsById = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    let node = object;
    let id = object.userData?.partId || object.userData?.cad_part_id;
    while (node && !id) {
      id = node.userData?.cad_part_id || node.userData?.partId;
      node = node.parent;
    }
    object.userData.partId = id;
    meshes.push(object);
    if (id) partsById.set(id, object);
  });
  return { meshes, partsById };
}

/** Return the 0..720 crank angle corresponding to a 0..100 motion progress for 720-degree cycle clips, else undefined. */
export function crankAngleForMotion(motion, progress = 0) {
  if (!motion) return undefined;
  const degrees = motion.degrees ?? motion.procedural?.degrees ?? (/cycle|operating/i.test(motion.id || '') ? 720 : undefined);
  if (degrees !== 720) return undefined;
  const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
  return Number((clamped * 7.2).toFixed(4));
}

/**
 * Resolve per-motion visibility and ghost sets from motion.display metadata (or part.cycle_visible fallback).
 * `viewMode` may be 'core' (default for motions that declare display filters) or 'assembled' (shows the full assembly).
 */
export function resolveMotionDisplay(motion, contractParts = [], viewMode = 'default') {
  const display = motion?.display;
  const defaultMode = display?.defaultViewMode || (display?.visiblePartIds || display?.ghostPartIds ? 'core' : 'assembled');
  const allowAssembled = Boolean(display?.allowAssembled ?? (display?.visiblePartIds || display?.ghostPartIds));
  const effectiveMode = viewMode === 'default' ? defaultMode : viewMode;
  if (effectiveMode === 'assembled') {
    return {
      viewMode: 'assembled',
      defaultViewMode: defaultMode,
      allowAssembled,
      hasDisplayFilter: false,
      visibleSet: null,
      ghostSet: new Set(),
    };
  }
  const ghostSet = new Set(Array.isArray(display?.ghostPartIds) ? display.ghostPartIds : []);
  let visibleIds = display?.visiblePartIds;
  if (!Array.isArray(visibleIds) && /cycle/i.test(motion?.id || '') && contractParts.some((p) => typeof p.cycle_visible === 'boolean')) {
    visibleIds = contractParts.filter((p) => p.cycle_visible).map((p) => p.id);
  }
  const visibleSet = Array.isArray(visibleIds) ? new Set([...visibleIds, ...ghostSet]) : null;
  return {
    viewMode: effectiveMode,
    defaultViewMode: defaultMode,
    allowAssembled,
    hasDisplayFilter: Boolean(visibleSet || ghostSet.size > 0),
    visibleSet,
    ghostSet,
  };
}

/**
 * Create a Three.js procedural motion sampler for an animated-study contract so static GLBs need zero baked keyframe tracks.
 */
export function createProceduralStudySampler(contract, partsById, root) {
  root.updateMatrixWorld(true);
  const restWorld = new Map();
  const parentInverse = new Map();
  for (const [id, mesh] of partsById.entries()) {
    restWorld.set(id, mesh.matrixWorld.clone());
    parentInverse.set(id, mesh.parent ? mesh.parent.matrixWorld.clone().invert() : new THREE.Matrix4());
  }
  const partSpecs = new Map((contract.parts || []).map((p) => [p.id, p]));
  const stageEnds = contract.procedural?.stageEnds || DEFAULT_STAGE_ENDS;
  const evaluateBody = createGtsioBodyEvaluator(contract.procedural?.parameters || {});

  function setWorldMatrix(id, mesh, worldMatrix) {
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(parentInverse.get(id)).multiply(worldMatrix);
    mesh.matrixWorld.copy(worldMatrix);
  }

  function restoreRest() {
    for (const [id, mesh] of partsById.entries()) {
      setWorldMatrix(id, mesh, restWorld.get(id));
    }
    root.updateMatrixWorld(true);
  }

  function applyExplosion(fraction) {
    const f = Math.max(0, Math.min(1, fraction));
    const delta = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    for (const [id, mesh] of partsById.entries()) {
      const spec = partSpecs.get(id);
      const exp = spec?.explosion;
      if (!exp || !exp.stage) {
        setWorldMatrix(id, mesh, restWorld.get(id));
        continue;
      }
      const s0 = stageEnds[exp.stage - 1] ?? 0;
      const s1 = stageEnds[exp.stage] ?? 1;
      const amount = s1 > s0 ? Math.max(0, Math.min(1, (f - s0) / (s1 - s0))) : 0;
      const [dx, dy, dz] = exp.offset_mm || [0, 0, 0];
      // CAD mm (dx, dy, dz) -> glTF metres (dx/1000, dz/1000, -dy/1000)
      delta.makeTranslation((dx * amount) / 1000, (dz * amount) / 1000, (-dy * amount) / 1000);
      world.copy(delta).multiply(restWorld.get(id));
      setWorldMatrix(id, mesh, world);
    }
    root.updateMatrixWorld(true);
  }

  function applyCoreCycle(theta) {
    const bodyCache = new Map();
    const world = new THREE.Matrix4();
    for (const [id, mesh] of partsById.entries()) {
      const spec = partSpecs.get(id);
      const body = spec?.body || `fixed:${id}`;
      if (body.startsWith('fixed:')) {
        setWorldMatrix(id, mesh, restWorld.get(id));
        continue;
      }
      let delta = bodyCache.get(body);
      if (!delta) {
        delta = evaluateBody(body, theta);
        bodyCache.set(body, delta);
      }
      world.copy(delta).multiply(restWorld.get(id));
      setWorldMatrix(id, mesh, world);
    }
    root.updateMatrixWorld(true);
  }

  return {
    supports(motion) {
      if (!motion) return false;
      if (motion.procedural?.type) return true;
      const hasExplosionSpecs = (contract.parts || []).some((p) => p.explosion);
      const hasBodies = (contract.parts || []).some((p) => p.body && !p.body.startsWith('fixed:'));
      if (/explode/i.test(motion.id) && hasExplosionSpecs) return true;
      if (/collapse/i.test(motion.id) && hasExplosionSpecs) return true;
      if (/cycle/i.test(motion.id) && hasBodies) return true;
      return false;
    },
    apply(motion, progress = 0) {
      const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
      const type = motion?.procedural?.type
        || (/explode/i.test(motion?.id || '') ? 'explode'
          : /collapse/i.test(motion?.id || '') ? 'collapse'
            : /cycle/i.test(motion?.id || '') ? 'gtsio-core-cycle' : '');
      if (type === 'explode') {
        applyExplosion(clamped / 100);
      } else if (type === 'collapse') {
        applyExplosion((100 - clamped) / 100);
      } else if (type === 'gtsio-core-cycle') {
        applyCoreCycle((clamped / 100) * 720);
      } else {
        restoreRest();
      }
    },
    restoreRest,
  };
}
