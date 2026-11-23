import * as THREE from 'three';
import { driveTrainPlan } from './drive-train-flow.mjs';
import {
  accessoryFlowState,
  oilPumpFlowState,
  tappetFlowState,
} from './mechanism-flow.mjs';

const TAU = Math.PI * 2;
const UP_A = new THREE.Vector3(0, 1, 0);
const UP_B = new THREE.Vector3(1, 0, 0);
const wrap01 = (v) => ((v % 1) + 1) % 1;

function worldBoxOf(mesh) {
  return mesh ? new THREE.Box3().setFromObject(mesh) : null;
}

function boxSpanAlongAxis(box, axis) {
  const size = box.getSize(new THREE.Vector3());
  return Math.abs(size.x * axis.x) + Math.abs(size.y * axis.y) + Math.abs(size.z * axis.z);
}

function longestAxisOf(box) {
  const s = box.getSize(new THREE.Vector3());
  if (s.x >= s.y && s.x >= s.z) return new THREE.Vector3(1, 0, 0);
  if (s.y >= s.x && s.y >= s.z) return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

function localCenterOf(mesh) {
  const box = worldBoxOf(mesh);
  const center = box.getCenter(new THREE.Vector3());
  return center.applyMatrix4(mesh.matrixWorld.clone().invert());
}

/** Zero-allocation dynamic tube mesh updated along a 3D CatmullRomCurve3. */
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
        const taper = u < 0.08 ? 0.5 + (u / 0.08) * 0.5 : u > 0.92 ? 0.5 + ((1 - u) / 0.08) * 0.5 : 1.0;
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

const chevPos = new THREE.Vector3();
const chevTan = new THREE.Vector3();

function updateChevrons(chevrons, curve, phase, scale, visible) {
  for (let i = 0; i < chevrons.length; i++) {
    const m = chevrons[i];
    m.visible = visible;
    if (!visible || !curve) continue;
    const u = wrap01(phase + i / chevrons.length);
    curve.getPoint(u, chevPos);
    curve.getTangent(u, chevTan).normalize();
    m.position.copy(chevPos);
    m.quaternion.setFromUnitVectors(UP_A, chevTan);
    m.scale.setScalar(scale);
  }
}

/* -------------------------------------------------------------------------- */
/* 1. HYDRAULIC TAPPET OIL FLOW & HYDRAULIC LOCK                              */
/* -------------------------------------------------------------------------- */
function buildTappetVisuals(group, spec, partsById, contract, registerMat, shared) {
  const body = partsById.get(spec.parts.body);
  const plunger = partsById.get(spec.parts.plunger);
  const checkPlate = partsById.get(spec.parts.checkPlate);
  const socket = partsById.get(spec.parts.socket);
  if (!body || !plunger || !socket) return null;

  const bodyBox = worldBoxOf(body);
  const plungerBox = worldBoxOf(plunger);
  const socketBox = worldBoxOf(socket);
  const bodyCenter = bodyBox.getCenter(new THREE.Vector3());
  const socketCenter = socketBox.getCenter(new THREE.Vector3());

  // Axis points from tappet base toward pushrod socket.
  const axis = socketCenter.clone().sub(bodyCenter);
  if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
  axis.normalize();
  const ref = Math.abs(axis.dot(UP_A)) > 0.9 ? UP_B : UP_A;
  const uAxis = new THREE.Vector3().crossVectors(axis, ref).normalize();

  const bodyLen = boxSpanAlongAxis(bodyBox, axis);
  const innerRadius = Math.max(0.002, boxSpanAlongAxis(plungerBox, uAxis) * 0.42);
  const bodyRadius = Math.max(innerRadius * 1.25, boxSpanAlongAxis(bodyBox, uAxis) * 0.5);
  const bodyLocalCenter = localCenterOf(body);
  const plungerLocalCenter = localCenterOf(plunger);
  const socketLocalCenter = localCenterOf(socket);
  const checkLocalCenter = checkPlate ? localCenterOf(checkPlate) : plungerLocalCenter.clone();

  const alignQuat = new THREE.Quaternion().setFromUnitVectors(UP_A, axis);
  const ringQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);

  // Trapped lower oil chamber.
  const chamberMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xf5b841,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const chamberMesh = new THREE.Mesh(shared.cylGeo, chamberMat);
  chamberMesh.renderOrder = 925;
  group.add(chamberMesh);

  // Hollow plunger oil reservoir.
  const reservoirMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xe6b44c,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const reservoirMesh = new THREE.Mesh(shared.cylGeo, reservoirMat);
  reservoirMesh.renderOrder = 920;
  group.add(reservoirMesh);

  // Check-valve status ring (teal = OPEN replenishing, amber-red = SEALED hydraulic lock).
  const checkRingMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0x38f2d6,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  }));
  const checkRing = new THREE.Mesh(shared.ringGeo, checkRingMat);
  checkRing.renderOrder = 985;
  group.add(checkRing);

  // Gallery supply & replenishment oil stream.
  const supplyMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xf6c94c,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const supplyRibbon = createDynamicRibbon(18, 6, supplyMat, 'tappet-supply');
  group.add(supplyRibbon.mesh);

  // Pushrod socket oil bleed stream.
  const bleedMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xffa938,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const bleedRibbon = createDynamicRibbon(12, 6, bleedMat, 'tappet-bleed');
  group.add(bleedRibbon.mesh);

  const chevMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xfff2c6,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  }));
  const supplyChevs = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(shared.chevGeo, chevMat);
    m.renderOrder = 975;
    group.add(m);
    return m;
  });
  const bleedChevs = [0, 1].map(() => {
    const m = new THREE.Mesh(shared.chevGeo, chevMat);
    m.renderOrder = 975;
    group.add(m);
    return m;
  });

  const coolGold = new THREE.Color(0xeab846);
  const hotAmber = new THREE.Color(0xff6b1a);
  const openTeal = new THREE.Color(0x38f2d6);
  const sealedRed = new THREE.Color(0xff5228);

  return {
    update(motionId, progress) {
      // The stages come from the contract so the banner and the stage buttons beside it name the same stage at every progress.
      const stages = contract?.motions?.find((motion) => motion.id === motionId)?.stages;
      const state = tappetFlowState(progress, stages?.length ? stages : undefined);
      const wBody = bodyLocalCenter.clone().applyMatrix4(body.matrixWorld);
      const wPlunger = plungerLocalCenter.clone().applyMatrix4(plunger.matrixWorld);
      const wSocket = socketLocalCenter.clone().applyMatrix4(socket.matrixWorld);
      const wCheck = checkPlate
        ? checkLocalCenter.clone().applyMatrix4(checkPlate.matrixWorld)
        : wPlunger.clone().addScaledVector(axis, -bodyLen * 0.14);

      const chamberBottom = wBody.clone().addScaledVector(axis, -bodyLen * 0.44);
      const chamberH = Math.max(innerRadius * 0.6, wCheck.clone().sub(chamberBottom).dot(axis));
      const chamberMid = chamberBottom.clone().addScaledVector(axis, chamberH * 0.5);

      chamberMesh.position.copy(chamberMid);
      chamberMesh.quaternion.copy(alignQuat);
      chamberMesh.scale.set(innerRadius * 0.96, chamberH, innerRadius * 0.96);
      chamberMat.color.copy(coolGold).lerp(hotAmber, state.trappedLock);
      chamberMat.opacity = 0.28 + state.trappedLock * 0.48;

      const resH = Math.max(innerRadius * 0.5, wSocket.clone().sub(wCheck).dot(axis) * 0.85);
      const resMid = wCheck.clone().addScaledVector(axis, resH * 0.55);
      reservoirMesh.position.copy(resMid);
      reservoirMesh.quaternion.copy(alignQuat);
      reservoirMesh.scale.set(innerRadius * 0.72, resH, innerRadius * 0.72);
      reservoirMat.opacity = 0.22 + state.supplyFlow * 0.24;

      checkRing.position.copy(wCheck);
      checkRing.quaternion.copy(ringQuat);
      checkRing.scale.setScalar(innerRadius * (state.checkValveOpen ? 0.95 : 0.78));
      checkRingMat.color.copy(state.checkValveOpen ? openTeal : sealedRed);

      // Gallery oil entry -> hollow plunger -> check valve -> lower chamber (when replenishing).
      const inletOuter = wBody.clone().addScaledVector(uAxis, bodyRadius * 1.55).addScaledVector(axis, bodyLen * 0.08);
      const inletPort = wBody.clone().addScaledVector(uAxis, bodyRadius * 0.92).addScaledVector(axis, bodyLen * 0.08);
      const midRes = wPlunger.clone().addScaledVector(axis, bodyLen * 0.04);
      const endPt = state.checkValveOpen ? chamberMid.clone() : wCheck.clone().addScaledVector(axis, innerRadius * 0.35);
      const supplyCurve = new THREE.CatmullRomCurve3([inletOuter, inletPort, midRes, endPt]);
      const ribRad = innerRadius * (0.14 + state.supplyFlow * 0.08);
      supplyRibbon.mesh.visible = true;
      supplyRibbon.update(supplyCurve, ribRad);
      supplyMat.opacity = 0.35 + state.supplyFlow * 0.5;
      updateChevrons(supplyChevs, supplyCurve, wrap01(progress / 28), innerRadius * 0.2, state.supplyFlow > 0.15);

      // Upward metering bleed through pushrod socket.
      const bleedStart = wPlunger.clone().addScaledVector(axis, bodyLen * 0.12);
      const bleedTop = wSocket.clone().addScaledVector(axis, bodyLen * 0.28);
      const bleedCurve = new THREE.CatmullRomCurve3([bleedStart, wSocket.clone(), bleedTop]);
      bleedRibbon.mesh.visible = true;
      bleedRibbon.update(bleedCurve, innerRadius * (0.1 + state.bleedFlow * 0.06));
      bleedMat.opacity = 0.28 + state.bleedFlow * 0.45;
      updateChevrons(bleedChevs, bleedCurve, wrap01(progress / 24), innerRadius * 0.16, state.bleedFlow > 0.2);

      return state.phaseLabel;
    },
    dispose() {
      supplyRibbon.geometry.dispose();
      bleedRibbon.geometry.dispose();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 2. OIL PUMP & RELIEF VALVE (OUTER GEAR-POCKET FLOW + RELIEF BYPASS)        */
/* -------------------------------------------------------------------------- */
function buildOilPumpVisuals(group, spec, partsById, registerMat, shared) {
  const driveGear = partsById.get(spec.parts.driveGear);
  const drivenGear = partsById.get(spec.parts.drivenGear);
  const driveShaft = partsById.get(spec.parts.driveShaft);
  const reliefPlunger = partsById.get(spec.parts.reliefPlunger);
  const reliefHousing = partsById.get(spec.parts.reliefHousing);
  if (!driveGear || !drivenGear) return null;

  const driveBox = worldBoxOf(driveGear);
  const drivenBox = worldBoxOf(drivenGear);
  const driveCenter = driveBox.getCenter(new THREE.Vector3());
  const drivenCenter = drivenBox.getCenter(new THREE.Vector3());
  const midCenter = driveCenter.clone().add(drivenCenter).multiplyScalar(0.5);

  const shaftAxis = driveShaft ? longestAxisOf(worldBoxOf(driveShaft)) : new THREE.Vector3(0, 1, 0);
  const gearVec = drivenCenter.clone().sub(driveCenter);
  gearVec.addScaledVector(shaftAxis, -gearVec.dot(shaftAxis)).normalize();
  const flowAxis = new THREE.Vector3().crossVectors(shaftAxis, gearVec).normalize();

  const gearRadius = Math.max(0.008, boxSpanAlongAxis(driveBox, flowAxis) * 0.5);
  const halfSpacing = driveCenter.distanceTo(drivenCenter) * 0.5;
  const ribRad = gearRadius * 0.16;
  const chevScale = gearRadius * 0.22;

  const suctionMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xefc94c,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const dischargeMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xff8420,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const bypassMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xff4f30,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));

  const outerArcA = createDynamicRibbon(26, 6, suctionMat, 'oil-pump-arc-drive');
  const outerArcB = createDynamicRibbon(26, 6, suctionMat, 'oil-pump-arc-driven');
  const dischargeStream = createDynamicRibbon(14, 6, dischargeMat, 'oil-pump-discharge');
  const bypassStream = createDynamicRibbon(22, 6, bypassMat, 'oil-pump-bypass');
  group.add(outerArcA.mesh, outerArcB.mesh, dischargeStream.mesh, bypassStream.mesh);

  // Build static geometric curves wrapping AROUND the outside of both gears (never through center mesh!).
  const inletStart = midCenter.clone().addScaledVector(flowAxis, -gearRadius * 2.15);
  const inletSplit = midCenter.clone().addScaledVector(flowAxis, -gearRadius * 1.15);
  const outletMerge = midCenter.clone().addScaledVector(flowAxis, gearRadius * 1.15);
  const outletEnd = midCenter.clone().addScaledVector(flowAxis, gearRadius * 2.25);

  function makeOuterArc(center, sideSign) {
    const r = gearRadius * 1.04;
    const pts = [inletStart.clone(), inletSplit.clone()];
    // Sweep 5 points around the outer half of the gear pocket.
    for (let i = 0; i <= 4; i++) {
      const a = -Math.PI * 0.45 + (i / 4) * Math.PI * 0.9;
      pts.push(
        center.clone()
          .addScaledVector(gearVec, sideSign * Math.cos(a) * r)
          .addScaledVector(flowAxis, Math.sin(a) * r),
      );
    }
    pts.push(outletMerge.clone());
    return new THREE.CatmullRomCurve3(pts);
  }

  const curveA = makeOuterArc(driveCenter, -1);
  const curveB = makeOuterArc(drivenCenter, 1);
  const dischargeCurve = new THREE.CatmullRomCurve3([
    outletMerge.clone(),
    midCenter.clone().addScaledVector(flowAxis, gearRadius * 1.65),
    outletEnd.clone(),
  ]);
  outerArcA.update(curveA, ribRad);
  outerArcB.update(curveB, ribRad);
  dischargeStream.update(dischargeCurve, ribRad * 1.15);

  const chevMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xfff3c4,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  }));
  const chevsA = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(shared.chevGeo, chevMat); m.renderOrder = 975; group.add(m); return m; });
  const chevsB = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(shared.chevGeo, chevMat); m.renderOrder = 975; group.add(m); return m; });
  const chevsOut = [0, 1].map(() => { const m = new THREE.Mesh(shared.chevGeo, chevMat); m.renderOrder = 975; group.add(m); return m; });
  const chevsBypass = [0, 1, 2].map(() => { const m = new THREE.Mesh(shared.chevGeo, chevMat); m.renderOrder = 975; group.add(m); return m; });

  // Relief plunger status ring.
  const reliefRingMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xff5a36,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }));
  const reliefRing = new THREE.Mesh(shared.ringGeo, reliefRingMat);
  reliefRing.renderOrder = 985;
  group.add(reliefRing);

  const reliefPlungerLocal = reliefPlunger ? localCenterOf(reliefPlunger) : null;
  const reliefAxis = reliefHousing ? longestAxisOf(worldBoxOf(reliefHousing)) : shaftAxis;
  const reliefRingQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), reliefAxis);
  const reliefRadius = reliefPlunger ? Math.max(0.004, boxSpanAlongAxis(worldBoxOf(reliefPlunger), flowAxis) * 0.65) : gearRadius * 0.45;

  return {
    update(motionId, progress) {
      const state = oilPumpFlowState(motionId, progress);
      const phase = wrap01(progress / 22);
      suctionMat.opacity = 0.45 + state.peripheralFlow * 0.38;
      dischargeMat.opacity = 0.45 + state.dischargeFlow * 0.42;

      updateChevrons(chevsA, curveA, phase, chevScale, true);
      updateChevrons(chevsB, curveB, wrap01(phase + 0.12), chevScale, true);
      updateChevrons(chevsOut, dischargeCurve, wrap01(phase * 1.3), chevScale * 1.1, true);

      if (reliefPlunger && reliefPlungerLocal) {
        const wRelief = reliefPlungerLocal.clone().applyMatrix4(reliefPlunger.matrixWorld);
        const showBypass = state.bypassFlow > 0.12;
        bypassStream.mesh.visible = showBypass;
        reliefRing.visible = true;
        reliefRing.position.copy(wRelief);
        reliefRing.quaternion.copy(reliefRingQuat);
        reliefRing.scale.setScalar(reliefRadius * (state.reliefOpen ? 1.25 : 0.9));
        reliefRingMat.opacity = state.reliefOpen ? 0.92 : 0.35;
        reliefRingMat.color.setHex(state.reliefOpen ? 0xff5533 : 0x5eead4);

        if (showBypass) {
          const midJump = outletMerge.clone().lerp(wRelief, 0.5).addScaledVector(shaftAxis, halfSpacing * 0.2);
          const returnJump = wRelief.clone().lerp(inletSplit, 0.5).addScaledVector(shaftAxis, -halfSpacing * 0.15);
          const bypassCurve = new THREE.CatmullRomCurve3([
            outletMerge.clone(),
            midJump,
            wRelief.clone(),
            returnJump,
            inletSplit.clone(),
          ]);
          bypassStream.update(bypassCurve, ribRad * (0.65 + state.bypassFlow * 0.55));
          bypassMat.opacity = 0.35 + state.bypassFlow * 0.55;
          updateChevrons(chevsBypass, bypassCurve, wrap01(progress / 18), chevScale * 0.95, true);
        } else {
          updateChevrons(chevsBypass, null, 0, 0, false);
        }
      } else {
        bypassStream.mesh.visible = false;
        reliefRing.visible = false;
        updateChevrons(chevsBypass, null, 0, 0, false);
      }

      return state.phaseLabel;
    },
    dispose() {
      outerArcA.geometry.dispose();
      outerArcB.geometry.dispose();
      dischargeStream.geometry.dispose();
      bypassStream.geometry.dispose();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 3. ACCESSORIES & DRIVES (TORQUE-FLOW RIBBONS & CHEVRONS ALONG THE GEAR TRAIN)  */
/* -------------------------------------------------------------------------- */
// What to draw, and which way each ribbon runs, comes from drive-train-flow.mjs (checked there against the contract's gear meshes).
// This function only turns that plan into meshes, so any contract with powerPaths gets it with no change here.
function buildAccessoryVisuals(group, partsById, contract, registerMat, shared) {
  const powerPaths = contract?.powerPaths || [];
  // One slot per edge of the largest thing that can be shown at once (the whole running train, or a single path).
  const slotCount = Math.max(1, driveTrainPlan(powerPaths).edges.length, ...powerPaths.map((path) => path.edges?.length || 0));

  // Drawn over the parts, not depth-tested: a torque path runs through gear bodies, and a ribbon thinner than the gear it crosses would be
  // hidden inside it (the gears here are 12 mm thick discs).
  const ribbonMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0x4ef5d2,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  const chevMat = registerMat(new THREE.MeshBasicMaterial({
    color: 0xe6fff9,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false,
  }));

  // Sizes come from the parts, not from metres: ribbons are a fraction of the typical size of the parts a path joins.
  const joined = new Set(powerPaths.flatMap((path) => (path.edges || []).flat()));
  const extents = [...joined].map((id) => partsById.get(id)).filter(Boolean)
    .map((mesh) => Math.max(...worldBoxOf(mesh).getSize(new THREE.Vector3()).toArray()))
    .sort((a, b) => a - b);
  const unit = extents.length ? extents[Math.floor(extents.length / 2)] : 0.05;

  const CHEVRONS_PER_EDGE = 2;
  const pool = Array.from({ length: slotCount }, (_, idx) => {
    const ribbon = createDynamicRibbon(10, 5, ribbonMat, `torque-edge-${idx}`);
    ribbon.mesh.visible = false;
    ribbon.mesh.renderOrder = 960;
    group.add(ribbon.mesh);
    const chevrons = Array.from({ length: CHEVRONS_PER_EDGE }, () => {
      const chev = new THREE.Mesh(shared.chevGeo, chevMat);
      chev.visible = false;
      chev.renderOrder = 975;
      group.add(chev);
      return chev;
    });
    return { ribbon, chevrons, line: new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3()) };
  });

  // Precompute local centers for O(1) per-frame lookup.
  const localCenters = new Map();
  for (const [id, mesh] of partsById.entries()) localCenters.set(id, localCenterOf(mesh));

  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();

  return {
    update(motionId, progress, activePowerPath) {
      const plan = driveTrainPlan(powerPaths, { activePathId: activePowerPath?.id, motionId });
      const state = accessoryFlowState(plan, progress);
      const focused = plan.mode === 'path';

      ribbonMat.color.setHex(plan.inbound ? 0xf472b6 : 0x4ef5d2);
      ribbonMat.opacity = focused ? 0.82 : 0.5;
      const radius = unit * (focused ? 0.07 : 0.05);
      const chevScale = unit * (focused ? 0.11 : 0.085);
      const phase = progress / 20;

      for (let i = 0; i < pool.length; i += 1) {
        const slot = pool[i];
        const edge = plan.edges[i];
        const meshA = edge && partsById.get(edge.from);
        const meshB = edge && partsById.get(edge.to);
        let drawn = false;
        if (meshA?.visible && meshB?.visible) {
          pointA.copy(localCenters.get(edge.from)).applyMatrix4(meshA.matrixWorld);
          pointB.copy(localCenters.get(edge.to)).applyMatrix4(meshB.matrixWorld);
          if (pointA.distanceTo(pointB) > 1e-4) {
            slot.line.v1.copy(pointA);
            slot.line.v2.copy(pointB);
            slot.ribbon.mesh.visible = true;
            slot.ribbon.update(slot.line, radius);
            // Chevrons travel from the driver to the driven part, each hop of the train a little behind the one before it.
            updateChevrons(slot.chevrons, slot.line, wrap01(phase - edge.hops * 0.18), chevScale, true);
            drawn = true;
          }
        }
        if (!drawn) {
          slot.ribbon.mesh.visible = false;
          updateChevrons(slot.chevrons, null, 0, 0, false);
        }
      }

      return state.phaseLabel;
    },
    dispose() {
      for (const slot of pool) slot.ribbon.geometry.dispose();
    },
  };
}

/**
 * Create a live fluid/torque flow overlay for a non-engine mechanical model.
 */
export function createMechanismFlowVisuals(scene, spec, partsById, contract) {
  const group = new THREE.Group();
  group.name = `Mechanism flow visuals (${spec.kind})`;
  group.visible = false;
  scene.add(group);

  const shared = {
    cylGeo: new THREE.CylinderGeometry(1, 1, 1, 20, 1),
    chevGeo: new THREE.ConeGeometry(1, 2.4, 8),
    ringGeo: new THREE.TorusGeometry(1, 0.075, 8, 28),
  };
  const allMaterials = [];
  const registerMat = (mat) => { allMaterials.push(mat); return mat; };

  let impl = null;
  if (spec.kind === 'hydraulic-tappet') {
    impl = buildTappetVisuals(group, spec, partsById, contract, registerMat, shared);
  } else if (spec.kind === 'oil-pump') {
    impl = buildOilPumpVisuals(group, spec, partsById, registerMat, shared);
  } else if (spec.kind === 'accessory-drives') {
    impl = buildAccessoryVisuals(group, partsById, contract, registerMat, shared);
  }

  return {
    group,
    setVisible(visible) {
      group.visible = Boolean(visible && impl);
    },
    setClippingPlane(plane) {
      const planes = plane ? [plane] : [];
      for (const mat of allMaterials) {
        mat.clippingPlanes = planes;
        mat.needsUpdate = true;
      }
    },
    update(motionId, progress, activePowerPath = null) {
      if (!group.visible || !impl) return '';
      return impl.update(motionId, progress, activePowerPath);
    },
    dispose() {
      scene.remove(group);
      impl?.dispose?.();
      shared.cylGeo.dispose();
      shared.chevGeo.dispose();
      shared.ringGeo.dispose();
      for (const m of allMaterials) m.dispose();
    },
  };
}
