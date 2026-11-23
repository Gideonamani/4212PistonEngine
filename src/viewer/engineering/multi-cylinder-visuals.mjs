import * as THREE from 'three';
import { cycleState } from './cycle-model.mjs';
import { headAnchorsOf, resolveBoreAxis } from './bore-geometry.mjs';
import { cylinderOttoAngle, ottoStrokeOf } from './multi-cylinder-cycle.mjs';

const TAU = Math.PI * 2;
const UP_A = new THREE.Vector3(0, 1, 0);
const UP_B = new THREE.Vector3(1, 0, 0);
const wrap01 = (v) => ((v % 1) + 1) % 1;

function monotonicStrokePhase(degrees, cyclesPer720) {
  const rad = (degrees * Math.PI) / 180;
  const integrated = (rad - 0.25 * Math.sin(2 * rad)) / (4 * Math.PI);
  return wrap01(integrated * cyclesPer720);
}

function makeGlowTexture(size = 48, power = 1.8) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
      const a = r >= 1 ? 0 : Math.pow(1 - r, power);
      const offset = (y * size + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(255 * a);
    }
  }
  const tex = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  return tex;
}

/** Zero-allocation dynamic tube ribbon updated in-place along a 3D CatmullRomCurve3. */
function createDynamicRibbon(segments, radialSegments, material, name) {
  const ringVerts = radialSegments + 1;
  const vertCount = (segments + 1) * ringVerts;
  const positions = new Float32Array(vertCount * 3);
  const indices = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + j + 1;
      const d = i * ringVerts + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 950;

  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();

  return {
    mesh,
    geometry,
    update(curve, radius) {
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        curve.getPoint(u, p);
        curve.getTangent(u, t).normalize();
        const ref = Math.abs(t.dot(UP_A)) > 0.92 ? UP_B : UP_A;
        n.crossVectors(t, ref).normalize();
        b.crossVectors(t, n).normalize();
        const taper = u < 0.1 ? 0.5 + (u / 0.1) * 0.5 : u > 0.88 ? 0.45 + ((1 - u) / 0.12) * 0.55 : 1.0;
        const rad = radius * taper;
        for (let j = 0; j <= radialSegments; j++) {
          const phi = (j / radialSegments) * TAU;
          const cosP = Math.cos(phi) * rad;
          const sinP = Math.sin(phi) * rad;
          const idx = (i * ringVerts + j) * 3;
          positions[idx] = p.x + n.x * cosP + b.x * sinP;
          positions[idx + 1] = p.y + n.y * cosP + b.y * sinP;
          positions[idx + 2] = p.z + n.z * cosP + b.z * sinP;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

function worldBoxOf(mesh) {
  return mesh ? new THREE.Box3().setFromObject(mesh) : null;
}

function boxSpanAlongAxis(box, axis) {
  const size = box.getSize(new THREE.Vector3());
  return Math.abs(size.x * axis.x) + Math.abs(size.y * axis.y) + Math.abs(size.z * axis.z);
}

function boxMaxAlongAxis(box, origin, axis) {
  let maxS = -Infinity;
  const c = new THREE.Vector3();
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        c.set(
          ix ? box.max.x : box.min.x,
          iy ? box.max.y : box.min.y,
          iz ? box.max.z : box.min.z,
        );
        const s = c.sub(origin).dot(axis);
        if (s > maxS) maxS = s;
      }
    }
  }
  return maxS;
}

/**
 * Calibrate a single cylinder's geometry in its barrel's local frame so both fixed and rotating
 * cylinders (e.g. 1913 Gnome rotary) automatically transform their flow cues with the barrel.
 */
function calibrateCylinder(cyl, partsById, engineCenter, spec) {
  const barrel = partsById.get(cyl.barrelId);
  const piston = partsById.get(cyl.pistonId);
  if (!barrel || !piston) return null;

  const barrelBox = worldBoxOf(barrel);
  const pistonBox = worldBoxOf(piston);
  const head = cyl.headId ? partsById.get(cyl.headId) : null;
  const intakeValve = cyl.intakeValveId ? partsById.get(cyl.intakeValveId) : null;
  const exhaustValve = cyl.exhaustValveId ? partsById.get(cyl.exhaustValveId) : null;
  const spark = cyl.sparkId ? partsById.get(cyl.sparkId) : null;

  const barrelCenter = barrelBox.getCenter(new THREE.Vector3());
  const pistonCenter = pistonBox.getCenter(new THREE.Vector3());
  const headCenter = head ? worldBoxOf(head).getCenter(new THREE.Vector3()) : null;
  const intakeCenter = intakeValve ? worldBoxOf(intakeValve).getCenter(new THREE.Vector3()) : null;
  const exhaustCenter = exhaustValve ? worldBoxOf(exhaustValve).getCenter(new THREE.Vector3()) : null;
  const sparkCenter = spark ? worldBoxOf(spark).getCenter(new THREE.Vector3()) : null;

  // The bore axis points from the crank end toward the combustion end (bore-geometry.mjs holds the rule and its tests).
  // The valves, head and plug sit at the combustion end, so they say which way that is; nothing flips it afterwards.
  const crank = spec.crankId ? partsById.get(spec.crankId) : null;
  const { axis: axisArray } = resolveBoreAxis({
    pistonCenter: pistonCenter.toArray(),
    barrelCenter: barrelCenter.toArray(),
    pistonSize: pistonBox.getSize(new THREE.Vector3()).toArray(),
    headAnchors: headAnchorsOf({
      intake: intakeCenter?.toArray(), exhaust: exhaustCenter?.toArray(), head: headCenter?.toArray(), spark: sparkCenter?.toArray(),
    }),
    crankCenter: crank ? worldBoxOf(crank).getCenter(new THREE.Vector3()).toArray() : undefined,
    engineCenter: engineCenter.toArray(),
    hint: spec.boreAxisHint,
  });
  const axis = new THREE.Vector3().fromArray(axisArray);

  // Orthonormal basis (uAxis, vAxis) perpendicular to bore axis.
  const ref = Math.abs(axis.dot(UP_A)) > 0.9 ? UP_B : UP_A;
  const uAxis = new THREE.Vector3().crossVectors(axis, ref).normalize();
  const vAxis = new THREE.Vector3().crossVectors(axis, uAxis).normalize();

  // Measure bore radius from piston cross-section perpendicular to axis.
  const spanU = boxSpanAlongAxis(pistonBox, uAxis);
  const spanV = boxSpanAlongAxis(pistonBox, vAxis);
  const pistonSpanAxis = boxSpanAlongAxis(pistonBox, axis);
  const boreRadius = Math.max(0.008, Math.min(spanU, spanV) * 0.44);
  const pistonCrownHalf = Math.max(0.004, pistonSpanAxis * 0.44);

  // Chamber top sits at the inner end of the barrel (or slightly below the valves).
  const barrelTopS = boxMaxAlongAxis(barrelBox, barrelCenter, axis);
  const chamberTopWorld = barrelCenter.clone().addScaledVector(axis, barrelTopS * 0.94);

  // Valve / port anchors in world space (fallback to symmetric sides of chamber top).
  const intakeWorld = intakeCenter
    ? intakeCenter.clone()
    : chamberTopWorld.clone().addScaledVector(uAxis, -boreRadius * 0.55).addScaledVector(axis, boreRadius * 0.25);
  const exhaustWorld = exhaustCenter
    ? exhaustCenter.clone()
    : chamberTopWorld.clone().addScaledVector(uAxis, boreRadius * 0.55).addScaledVector(axis, boreRadius * 0.25);
  const sparkWorld = sparkCenter
    ? sparkCenter.clone()
    : chamberTopWorld.clone().addScaledVector(axis, -boreRadius * 0.18);

  // Convert anchors and basis into barrel-local space so rotating barrels carry everything automatically.
  const invBarrel = barrel.matrixWorld.clone().invert();
  const normalMat = new THREE.Matrix3().setFromMatrix4(invBarrel);
  const toLocalPoint = (pt) => pt.clone().applyMatrix4(invBarrel);
  const toLocalDir = (dir) => dir.clone().applyMatrix3(normalMat).normalize();

  // Piston local center for O(1) per-frame world-position lookup.
  const invPiston = piston.matrixWorld.clone().invert();
  const pistonLocalCenter = pistonCenter.clone().applyMatrix4(invPiston);

  return {
    spec: cyl,
    barrel,
    piston,
    pistonLocalCenter,
    pistonCrownHalf,
    boreRadius,
    localOrigin: toLocalPoint(barrelCenter),
    localAxis: toLocalDir(axis),
    localU: toLocalDir(uAxis),
    localV: toLocalDir(vAxis),
    localChamberTop: toLocalPoint(chamberTopWorld),
    localIntake: toLocalPoint(intakeWorld),
    localExhaust: toLocalPoint(exhaustWorld),
    localSpark: toLocalPoint(sparkWorld),
  };
}

/**
 * Create a multi-cylinder thermodynamic & airflow visual overlay attached to `scene`.
 * Supports all cylinders pulsing in firing order + high-detail ribbons/particles on the Hero Cylinder.
 */
export function createMultiCylinderVisuals(scene, spec, partsById) {
  const group = new THREE.Group();
  group.name = 'Multi-cylinder cycle visuals';
  group.visible = false;
  scene.add(group);

  // Compute approximate engine center from all referenced barrels for outward-axis disambiguation.
  const engineCenter = new THREE.Vector3();
  let centerCount = 0;
  for (const cyl of spec.cylinders) {
    const b = partsById.get(cyl.barrelId);
    if (!b) continue;
    engineCenter.add(worldBoxOf(b).getCenter(new THREE.Vector3()));
    centerCount += 1;
  }
  if (centerCount > 0) engineCenter.divideScalar(centerCount);

  const glowTex = makeGlowTexture(48, 1.8);
  const sharedChargeGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1);
  const sharedCoreGeo = new THREE.SphereGeometry(1, 14, 10);
  const sharedChevronGeo = new THREE.ConeGeometry(1, 2.4, 8);
  const sharedRingGeo = new THREE.TorusGeometry(1, 0.065, 8, 28);

  const allMaterials = [];
  const registerMat = (mat) => { allMaterials.push(mat); return mat; };

  const layers = { air: true, fuel: true, chamber: true };
  let clippingPlanes = [];

  const intakeColor = new THREE.Color(0x34e0ff);
  const compressionColor = new THREE.Color(0x5288ff);
  const fireColor = new THREE.Color(0xff922b);
  const flashColor = new THREE.Color(0xfff1b8);
  const exhaustColor = new THREE.Color(0xff6b2b);
  const monosoupapeMixColor = new THREE.Color(0xd966ff);
  const tmpColor = new THREE.Color();

  // Shared hero-cylinder kinetic charge particles (36 glowing droplets swirling inside the active bore).
  const PARTICLE_COUNT = 36;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleSeeds = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    r: 0.16 + ((i * 0.6180339) % 1) * 0.72,
    theta: (i / PARTICLE_COUNT) * TAU * 3,
    h: ((i * 0.381966) % 1),
    speed: 0.7 + ((i * 0.27) % 0.6),
  }));
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = registerMat(new THREE.PointsMaterial({
    map: glowTex,
    color: 0x62f4ff,
    size: 0.016,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  const heroParticles = new THREE.Points(particleGeo, particleMat);
  heroParticles.frustumCulled = false;
  heroParticles.renderOrder = 980;
  group.add(heroParticles);

  // Hero-cylinder halo ring around the top of the bore so the tracked cylinder stands out cleanly.
  const heroRingMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  }));
  const heroRing = new THREE.Mesh(sharedRingGeo, heroRingMat);
  heroRing.renderOrder = 990;
  group.add(heroRing);

  const units = [];
  for (const cyl of spec.cylinders) {
    const cal = calibrateCylinder(cyl, partsById, engineCenter, spec);
    if (!cal) continue;

    const chargeMat = registerMat(new THREE.MeshBasicMaterial({
      color: 0x34e0ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    const chargeMesh = new THREE.Mesh(sharedChargeGeo, chargeMat);
    chargeMesh.renderOrder = 920;
    group.add(chargeMesh);

    const coreMat = registerMat(new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const coreMesh = new THREE.Mesh(sharedCoreGeo, coreMat);
    coreMesh.renderOrder = 940;
    group.add(coreMesh);

    const sparkMat = registerMat(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfff3c4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const sparkSprite = new THREE.Sprite(sparkMat);
    sparkSprite.renderOrder = 995;
    group.add(sparkSprite);

    // Primary intake & exhaust ribbons (1 per port for all cylinders; 2 extra flanks on hero).
    const intakeMat = registerMat(new THREE.MeshBasicMaterial({
      color: 0x38e8ff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const exhaustMat = registerMat(new THREE.MeshBasicMaterial({
      color: 0xff8232,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const intakeRibbon = createDynamicRibbon(16, 6, intakeMat, `${cyl.id}-intake`);
    const exhaustRibbon = createDynamicRibbon(16, 6, exhaustMat, `${cyl.id}-exhaust`);
    const intakeFlankA = createDynamicRibbon(14, 5, intakeMat, `${cyl.id}-intake-a`);
    const intakeFlankB = createDynamicRibbon(14, 5, intakeMat, `${cyl.id}-intake-b`);
    const exhaustFlankA = createDynamicRibbon(14, 5, exhaustMat, `${cyl.id}-exhaust-a`);
    const exhaustFlankB = createDynamicRibbon(14, 5, exhaustMat, `${cyl.id}-exhaust-b`);
    group.add(
      intakeRibbon.mesh,
      exhaustRibbon.mesh,
      intakeFlankA.mesh,
      intakeFlankB.mesh,
      exhaustFlankA.mesh,
      exhaustFlankB.mesh,
    );

    // Two directional chevrons per port.
    const intakeChevMat = registerMat(new THREE.MeshBasicMaterial({
      color: 0xdcfbff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }));
    const exhaustChevMat = registerMat(new THREE.MeshBasicMaterial({
      color: 0xffe4c4,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }));
    const intakeChevrons = [0, 1].map(() => {
      const m = new THREE.Mesh(sharedChevronGeo, intakeChevMat);
      m.renderOrder = 965;
      group.add(m);
      return m;
    });
    const exhaustChevrons = [0, 1].map(() => {
      const m = new THREE.Mesh(sharedChevronGeo, exhaustChevMat);
      m.renderOrder = 965;
      group.add(m);
      return m;
    });

    // Optional Monosoupape skirt-port transfer ring (for 1913 Gnome rotary).
    let skirtRing = null;
    let skirtMat = null;
    if (spec.monosoupape) {
      skirtMat = registerMat(new THREE.MeshBasicMaterial({
        color: monosoupapeMixColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      skirtRing = new THREE.Mesh(sharedRingGeo, skirtMat);
      skirtRing.renderOrder = 960;
      group.add(skirtRing);
    }

    units.push({
      cal,
      chargeMesh,
      chargeMat,
      coreMesh,
      coreMat,
      sparkSprite,
      sparkMat,
      intakeRibbon,
      exhaustRibbon,
      intakeFlankA,
      intakeFlankB,
      exhaustFlankA,
      exhaustFlankB,
      intakeMat,
      exhaustMat,
      intakeChevrons,
      exhaustChevrons,
      intakeChevMat,
      exhaustChevMat,
      skirtRing,
      skirtMat,
    });
  }

  // Reusable scratch vectors/matrices (zero per-frame heap churn).
  const wAxis = new THREE.Vector3();
  const wU = new THREE.Vector3();
  const wV = new THREE.Vector3();
  const wTop = new THREE.Vector3();
  const wPiston = new THREE.Vector3();
  const wCrown = new THREE.Vector3();
  const wMid = new THREE.Vector3();
  const wIntake = new THREE.Vector3();
  const wExhaust = new THREE.Vector3();
  const wSpark = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();
  const alignQuat = new THREE.Quaternion();
  const chevTan = new THREE.Vector3();
  const chevPos = new THREE.Vector3();
  const portEntry = new THREE.Vector3();
  const portNeck = new THREE.Vector3();
  const chamberTarget = new THREE.Vector3();
  const flankOffset = new THREE.Vector3();

  function buildPortCurve(entry, valve, chamberPt, lateral, spread) {
    flankOffset.copy(lateral).multiplyScalar(spread);
    const p0 = entry.clone().addScaledVector(flankOffset, 0.7);
    const p1 = valve.clone().addScaledVector(flankOffset, 1.0);
    const p2 = chamberPt.clone().addScaledVector(flankOffset, 0.65);
    return new THREE.CatmullRomCurve3([p0, p1, p2]);
  }

  function updateChevrons(chevrons, curve, phase, scale, visible) {
    for (let i = 0; i < chevrons.length; i++) {
      const m = chevrons[i];
      m.visible = visible;
      if (!visible) continue;
      const u = wrap01(phase + i / chevrons.length);
      curve.getPoint(u, chevPos);
      curve.getTangent(u, chevTan).normalize();
      m.position.copy(chevPos);
      m.quaternion.setFromUnitVectors(UP_A, chevTan);
      m.scale.setScalar(scale);
    }
  }

  function setClippingPlane(plane) {
    clippingPlanes = plane ? [plane] : [];
    for (const mat of allMaterials) {
      mat.clippingPlanes = clippingPlanes;
      mat.needsUpdate = true;
    }
  }

  function setLayers(next) {
    if (typeof next.air === 'boolean') layers.air = next.air;
    if (typeof next.fuel === 'boolean') layers.fuel = next.fuel;
    if (typeof next.chamber === 'boolean') layers.chamber = next.chamber;
  }

  function update(crankAngleDeg, mode = 'ideal', heroCylinderId = spec.cylinders[0]?.id) {
    if (!group.visible) return '';
    let heroSummary = '';
    let heroFound = false;

    for (const unit of units) {
      const { cal } = unit;
      const isHero = cal.spec.id === heroCylinderId;
      const localAngle = cylinderOttoAngle(crankAngleDeg, spec, cal.spec.id);
      const state = cycleState(localAngle, mode, 'otto');
      const stroke = ottoStrokeOf(localAngle);

      // Transform barrel-local frame to live world space (tracks rotating cylinders automatically).
      const bm = cal.barrel.matrixWorld;
      normalMat.setFromMatrix4(bm);
      wAxis.copy(cal.localAxis).applyMatrix3(normalMat).normalize();
      wU.copy(cal.localU).applyMatrix3(normalMat).normalize();
      wV.copy(cal.localV).applyMatrix3(normalMat).normalize();
      wTop.copy(cal.localChamberTop).applyMatrix4(bm);
      wIntake.copy(cal.localIntake).applyMatrix4(bm);
      wExhaust.copy(cal.localExhaust).applyMatrix4(bm);
      wSpark.copy(cal.localSpark).applyMatrix4(bm);

      // Live piston crown along the cylinder axis.
      wPiston.copy(cal.pistonLocalCenter).applyMatrix4(cal.piston.matrixWorld);
      wCrown.copy(wPiston).addScaledVector(wAxis, cal.pistonCrownHalf);

      const rawHeight = wTop.clone().sub(wCrown).dot(wAxis);
      const minClearance = cal.boreRadius * 0.28;
      const height = Math.max(minClearance, Math.min(cal.boreRadius * 4.2, rawHeight));
      wMid.copy(wTop).addScaledVector(wAxis, -height * 0.5);

      alignQuat.setFromUnitVectors(UP_A, wAxis);

      // 1. Live cylindrical charge volume.
      const showChamber = layers.chamber;
      unit.chargeMesh.visible = showChamber;
      if (showChamber) {
        unit.chargeMesh.position.copy(wMid);
        unit.chargeMesh.quaternion.copy(alignQuat);
        unit.chargeMesh.scale.set(cal.boreRadius * 0.94, height, cal.boreRadius * 0.94);

        const burn = state.combustionIntensity ?? 0;
        if (stroke === 'intake') {
          tmpColor.copy(intakeColor);
        } else if (stroke === 'compression') {
          const t = Math.min(1, (localAngle - 180) / 180);
          tmpColor.copy(intakeColor).lerp(compressionColor, t * 0.85);
        } else if (stroke === 'power') {
          const t = Math.min(1, (localAngle - 360) / 180);
          tmpColor.copy(burn > 0.35 ? flashColor : fireColor).lerp(exhaustColor, t * 0.75);
        } else {
          tmpColor.copy(exhaustColor);
        }
        unit.chargeMat.color.copy(tmpColor);
        const baseAlpha = isHero ? 0.36 : 0.22;
        unit.chargeMat.opacity = Math.min(0.72, baseAlpha + burn * 0.38);
      }

      // 2. Inner combustion core glow during ignition / power.
      const burn = state.combustionIntensity ?? 0;
      const showCore = showChamber && burn > 0.04;
      unit.coreMesh.visible = showCore;
      if (showCore) {
        unit.coreMesh.position.copy(wTop).addScaledVector(wAxis, -Math.min(height * 0.45, cal.boreRadius * 0.65));
        const coreR = cal.boreRadius * (0.45 + burn * 0.42);
        unit.coreMesh.scale.set(coreR, Math.min(height * 0.45, coreR), coreR);
        unit.coreMat.color.copy(burn > 0.55 ? flashColor : fireColor);
        unit.coreMat.opacity = Math.min(0.9, burn * (isHero ? 0.85 : 0.6));
      }

      // 3. Spark plug ignition flash.
      const sparkOn = showChamber && (state.sparkIntensity ?? 0) > 0.05;
      unit.sparkSprite.visible = sparkOn;
      if (sparkOn) {
        const s = state.sparkIntensity;
        unit.sparkSprite.position.copy(wSpark);
        const size = cal.boreRadius * (0.9 + s * 1.4);
        unit.sparkSprite.scale.set(size, size, 1);
        unit.sparkMat.opacity = Math.min(1, s * 1.15);
      }

      // 4. Intake & exhaust flow ribbons + chevrons.
      const phase = monotonicStrokePhase(localAngle, 4);
      const showAir = layers.air;
      const intakeFlow = spec.monosoupape
        ? (localAngle >= 0 && localAngle <= 115 ? Math.sin((localAngle / 115) * Math.PI) : 0)
        : (state.intakeFlow ?? 0);
      const exhaustFlow = spec.monosoupape
        ? (localAngle >= 460 && localAngle <= 720 ? Math.sin(((localAngle - 460) / 260) * Math.PI) : 0)
        : (state.exhaustFlow ?? 0);

      const intakeActive = showAir && intakeFlow > 0.06;
      const exhaustActive = showAir && exhaustFlow > 0.06;
      const ribbonRad = cal.boreRadius * (isHero ? 0.13 : 0.095);
      const chevScale = cal.boreRadius * (isHero ? 0.19 : 0.14);

      if (intakeActive) {
        portEntry.copy(wIntake).addScaledVector(wAxis, cal.boreRadius * 1.15);
        portNeck.copy(wIntake);
        chamberTarget.copy(wMid);
        const mainCurve = buildPortCurve(portEntry, portNeck, chamberTarget, wV, 0);
        unit.intakeRibbon.mesh.visible = true;
        unit.intakeRibbon.update(mainCurve, ribbonRad * (0.65 + 0.35 * intakeFlow));
        unit.intakeMat.opacity = (isHero ? 0.72 : 0.45) * Math.min(1, intakeFlow * 1.2);
        updateChevrons(unit.intakeChevrons, mainCurve, phase, chevScale, true);

        // Hero cylinder gets 2 flank ribbons (3-strand stream).
        unit.intakeFlankA.mesh.visible = isHero;
        unit.intakeFlankB.mesh.visible = isHero;
        if (isHero) {
          unit.intakeFlankA.update(buildPortCurve(portEntry, portNeck, chamberTarget, wV, cal.boreRadius * 0.34), ribbonRad * 0.72);
          unit.intakeFlankB.update(buildPortCurve(portEntry, portNeck, chamberTarget, wV, -cal.boreRadius * 0.34), ribbonRad * 0.72);
        }
      } else {
        unit.intakeRibbon.mesh.visible = false;
        unit.intakeFlankA.mesh.visible = false;
        unit.intakeFlankB.mesh.visible = false;
        updateChevrons(unit.intakeChevrons, null, 0, 0, false);
      }

      if (exhaustActive) {
        portEntry.copy(wExhaust).addScaledVector(wAxis, cal.boreRadius * 1.2);
        portNeck.copy(wExhaust);
        chamberTarget.copy(wMid);
        // Exhaust flows OUT: chamber -> valve -> port entry.
        const mainCurve = buildPortCurve(chamberTarget, portNeck, portEntry, wV, 0);
        unit.exhaustRibbon.mesh.visible = true;
        unit.exhaustRibbon.update(mainCurve, ribbonRad * (0.65 + 0.35 * exhaustFlow));
        unit.exhaustMat.opacity = (isHero ? 0.72 : 0.45) * Math.min(1, exhaustFlow * 1.2);
        updateChevrons(unit.exhaustChevrons, mainCurve, phase, chevScale, true);

        unit.exhaustFlankA.mesh.visible = isHero;
        unit.exhaustFlankB.mesh.visible = isHero;
        if (isHero) {
          unit.exhaustFlankA.update(buildPortCurve(chamberTarget, portNeck, portEntry, wV, cal.boreRadius * 0.34), ribbonRad * 0.72);
          unit.exhaustFlankB.update(buildPortCurve(chamberTarget, portNeck, portEntry, wV, -cal.boreRadius * 0.34), ribbonRad * 0.72);
        }
      } else {
        unit.exhaustRibbon.mesh.visible = false;
        unit.exhaustFlankA.mesh.visible = false;
        unit.exhaustFlankB.mesh.visible = false;
        updateChevrons(unit.exhaustChevrons, null, 0, 0, false);
      }

      // 5. Monosoupape crankcase skirt-port rich mixture burst near BDC (115°..195°).
      if (unit.skirtRing && unit.skirtMat) {
        const transfer = localAngle >= 115 && localAngle <= 195
          ? Math.sin(((localAngle - 115) / 80) * Math.PI)
          : 0;
        const showSkirt = layers.fuel && transfer > 0.05;
        unit.skirtRing.visible = showSkirt;
        if (showSkirt) {
          unit.skirtRing.position.copy(wCrown).addScaledVector(wAxis, cal.boreRadius * 0.14);
          unit.skirtRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wAxis);
          unit.skirtRing.scale.setScalar(cal.boreRadius * 0.96);
          unit.skirtMat.opacity = transfer * (isHero ? 0.85 : 0.5);
        }
      }

      // 6. Hero cylinder halo ring + swirling kinetic particles inside the bore.
      if (isHero) {
        heroFound = true;
        heroRing.visible = true;
        heroRing.position.copy(wTop).addScaledVector(wAxis, -cal.boreRadius * 0.05);
        heroRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wAxis);
        heroRing.scale.setScalar(cal.boreRadius * 1.06);

        const showParticles = layers.fuel;
        heroParticles.visible = showParticles;
        if (showParticles) {
          particleMat.size = Math.max(0.008, cal.boreRadius * 0.28);
          particleMat.color.copy(
            stroke === 'intake' ? intakeColor
              : stroke === 'compression' ? compressionColor
                : stroke === 'power' ? fireColor
                  : exhaustColor,
          );
          const spinRad = (localAngle * Math.PI) / 180 * 2.2;
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const seed = particleSeeds[i];
            const ang = seed.theta + spinRad * seed.speed;
            const rad = seed.r * cal.boreRadius * 0.86;
            const hFrac = wrap01(seed.h + (stroke === 'intake' ? -phase * 0.4 : stroke === 'exhaust' ? phase * 0.5 : 0));
            const px = wCrown.x + wAxis.x * (hFrac * height) + (wU.x * Math.cos(ang) + wV.x * Math.sin(ang)) * rad;
            const py = wCrown.y + wAxis.y * (hFrac * height) + (wU.y * Math.cos(ang) + wV.y * Math.sin(ang)) * rad;
            const pz = wCrown.z + wAxis.z * (hFrac * height) + (wU.z * Math.cos(ang) + wV.z * Math.sin(ang)) * rad;
            particlePositions[i * 3] = px;
            particlePositions[i * 3 + 1] = py;
            particlePositions[i * 3 + 2] = pz;
          }
          particleGeo.attributes.position.needsUpdate = true;
        }

        heroSummary = `${spec.engineLabel} · Tracking ${cal.spec.label} (${Math.round(localAngle)}°, ${stroke}). Illustrative cycle overlay.`;
      }
    }

    if (!heroFound) {
      heroRing.visible = false;
      heroParticles.visible = false;
    }

    return heroSummary;
  }

  return {
    group,
    setVisible(visible) {
      group.visible = Boolean(visible);
    },
    setLayers,
    setClippingPlane,
    update,
    dispose() {
      scene.remove(group);
      sharedChargeGeo.dispose();
      sharedCoreGeo.dispose();
      sharedChevronGeo.dispose();
      sharedRingGeo.dispose();
      particleGeo.dispose();
      glowTex.dispose();
      for (const u of units) {
        u.intakeRibbon.geometry.dispose();
        u.exhaustRibbon.geometry.dispose();
        u.intakeFlankA.geometry.dispose();
        u.intakeFlankB.geometry.dispose();
        u.exhaustFlankA.geometry.dispose();
        u.exhaustFlankB.geometry.dispose();
      }
      for (const m of allMaterials) m.dispose();
    },
  };
}
