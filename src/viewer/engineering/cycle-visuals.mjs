import * as THREE from 'three';
import { cycleCueState } from './cycle-cues.mjs';

const TAU = Math.PI * 2;
const toThree = (a) => new THREE.Vector3(a[0], a[2], -a[1]).multiplyScalar(0.001);
const wrap = (v) => ((v % 1) + 1) % 1;

/**
 * Strictly monotonic flow scroll over 0–720° whose derivative is (0.5 + sin²θ) > 0 everywhere.
 * Speeds up smoothly at mid-stroke (90°, 270°, 450°, 630°) and slows at TDC/BDC without ever
 * reversing phase (multiplying degrees by a decaying velocity causes apparent back-flow).
 */
function monotonicStrokePhase(degrees, cyclesPer720) {
  const rad = (degrees * Math.PI) / 180;
  const integrated = (rad - 0.25 * Math.sin(2 * rad)) / (4 * Math.PI);
  return wrap(integrated * cyclesPer720);
}

/** Soft radial glow texture for kinetic charge particles and spark plug flashes. */
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

/**
 * Reusable zero-allocation dynamic tube mesh updated in-place along a sampled 3D curve.
 * Mirrors GTEWebMockups' smooth translucent flow ribbons while adapting every frame to
 * valve lift and moving piston clearance without allocating BufferGeometries.
 */
function createDynamicRibbon(segments, radialSegments, radius, material, name) {
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
  const upA = new THREE.Vector3(0, 1, 0);
  const upB = new THREE.Vector3(1, 0, 0);

  return {
    mesh,
    geometry,
    update(curve, currentRadius = radius) {
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        curve.getPoint(u, p);
        curve.getTangent(u, t).normalize();
        const ref = Math.abs(t.dot(upA)) > 0.92 ? upB : upA;
        n.crossVectors(t, ref).normalize();
        b.crossVectors(t, n).normalize();
        // Gentle taper at entry and exit tips for an organic stream look.
        const endTaper = u < 0.08 ? 0.55 + (u / 0.08) * 0.45 : u > 0.9 ? 0.5 + ((1 - u) / 0.1) * 0.5 : 1.0;
        const rad = currentRadius * endTaper;
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

/** Build CAD-frame control points for one of 3 annular port strands curving around the valve tulip. */
function buildPortStrandCadMm(name, strandOffsetZ, lift, pistonPinMm, landmarks) {
  const port = landmarks.ports[name];
  const valve = port.valve;
  const vAxis = valve.axis;
  const vOrigin = valve.origin_mm;
  const sideSign = Math.sign(vOrigin[1]); // -1 intake, +1 exhaust
  const towards = [0, -sideSign, 0];
  const proj = towards[0] * vAxis[0] + towards[1] * vAxis[1] + towards[2] * vAxis[2];
  const radial = [towards[0] - proj * vAxis[0], towards[1] - proj * vAxis[1], towards[2] - proj * vAxis[2]];
  const rLen = Math.hypot(radial[0], radial[1], radial[2]) || 1;
  radial[0] /= rLen;
  radial[1] /= rLen;
  radial[2] /= rLen;

  const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const chamber = landmarks.chamber;
  const pistonCrownX = pistonPinMm + chamber.piston_front_offset_mm;
  const floorX = pistonCrownX + 5;
  const spreadZ = strandOffsetZ; // -1, 0, +1
  const portZ = spreadZ * (port.radius_mm * 0.44);
  const skirtZ = spreadZ * (valve.head_radius_mm * 0.56);
  const boreRadiusMm = chamber.bore_radius_mm ?? 51;
  const boreZ = spreadZ * Math.min(22, boreRadiusMm * 0.44);

  const outerEntry = add(port.outer_endpoint_mm, port.outward_axis, 26);
  const outerPort = [port.outer_endpoint_mm[0], port.outer_endpoint_mm[1], portZ];
  const midPort = [
    (port.outer_endpoint_mm[0] + port.inner_origin_mm[0]) * 0.5,
    (port.outer_endpoint_mm[1] + port.inner_origin_mm[1]) * 0.5,
    portZ * 0.9,
  ];
  const innerTurn = [port.inner_origin_mm[0], port.inner_origin_mm[1], portZ * 0.75];
  const throat = add(add(vOrigin, vAxis, 11), radial, valve.head_radius_mm * 0.48);
  throat[2] += skirtZ * 0.65;
  const gap = add(add(vOrigin, vAxis, -Math.max(1.2, lift) * 0.55), radial, valve.head_radius_mm * (Math.abs(spreadZ) > 0.1 ? 0.88 : 1.0));
  gap[2] += skirtZ;
  const pastHead = add(add(vOrigin, vAxis, -Math.max(2, lift) - 7), radial, valve.head_radius_mm * 0.55);
  pastHead[2] += boreZ * 0.75;
  const chamberMidX = Math.max(floorX + 2, Math.min(chamber.front_x_mm - 8, pistonCrownX + Math.max(12, (chamber.front_x_mm - pistonCrownX) * 0.48)));
  const chamberEnd = [chamberMidX, sideSign * 14, boreZ];

  const pts = [
    [outerEntry[0], outerEntry[1], portZ],
    outerPort,
    midPort,
    innerTurn,
    throat,
    gap,
    pastHead,
    chamberEnd,
  ].map((pt) => [Math.max(floorX, pt[0]), pt[1], pt[2]]);

  return name === 'intake' ? pts : pts.reverse();
}

export function createCycleVisuals(scene, landmarks, camera) {
  const group = new THREE.Group();
  group.name = 'Illustrative cycle cues';
  scene.add(group);

  const materials = new Set();
  let activeClipPlanes = [];
  const trackMat = (mat) => {
    mat.clippingPlanes = activeClipPlanes;
    materials.add(mat);
    return mat;
  };

  const softTex = makeGlowTexture(48, 1.7);
  const sparkTex = makeGlowTexture(64, 2.8);

  // Layer sub-groups so learners can toggle Air & Exhaust, Fuel Spray, and Chamber & Spark independently.
  const airGroup = new THREE.Group();
  airGroup.name = 'Air and exhaust streams';
  const fuelGroup = new THREE.Group();
  fuelGroup.name = 'Continuous port fuel spray';
  const chamberGroup = new THREE.Group();
  chamberGroup.name = 'Chamber charge and ignition';
  group.add(airGroup, fuelGroup, chamberGroup);

  const layers = { air: true, fuel: true, chamber: true };

  // Reusable directional cone geometry (pointing +Z so Three.js lookAt aligns tip with tangent).
  const coneGeo = new THREE.ConeGeometry(1, 2.8, 8).rotateX(Math.PI / 2);

  // ---------------------------------------------------------------------------
  // 1. Multi-strand Intake & Exhaust ribbons + animated directional arrow cones
  // ---------------------------------------------------------------------------
  const STRAND_OFFSETS = [-1, 0, 1];
  const TRACERS_PER_STRAND = 4;

  function createPortSystem(portName, ribbonColor, coneColor, radiusM) {
    const portGroup = new THREE.Group();
    portGroup.name = `${portName} flow ribbons`;
    airGroup.add(portGroup);

    const ribbonMat = trackMat(new THREE.MeshBasicMaterial({
      color: ribbonColor,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    }));
    const coneMat = trackMat(new THREE.MeshBasicMaterial({
      color: coneColor,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: false,
    }));

    const strands = STRAND_OFFSETS.map((offsetZ, sIdx) => {
      const pts = Array.from({ length: 8 }, () => new THREE.Vector3());
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.38);
      const ribbon = createDynamicRibbon(26, 6, radiusM, ribbonMat, `${portName} ribbon ${sIdx}`);
      portGroup.add(ribbon.mesh);

      const tracers = Array.from({ length: TRACERS_PER_STRAND }, (_, k) => {
        const mesh = new THREE.Mesh(coneGeo, coneMat);
        mesh.name = `${portName} directional tracer`;
        mesh.frustumCulled = false;
        mesh.renderOrder = 965;
        portGroup.add(mesh);
        return { mesh, phase: k / TRACERS_PER_STRAND + sIdx * 0.13 };
      });
      return { offsetZ, pts, curve, ribbon, tracers };
    });

    return { portGroup, ribbonMat, coneMat, strands, radiusM };
  }

  const intakeSys = createPortSystem('intake', 0x38e0ee, 0xe8fdff, 0.0026);
  const exhaustSys = createPortSystem('exhaust', 0xff8a47, 0xffe4cc, 0.0023);

  // ---------------------------------------------------------------------------
  // 2. Continuous Port Fuel Spray (anchored to FuelDischargeNozzle in GLB)
  // ---------------------------------------------------------------------------
  // FuelDischargeNozzle sits at Three.js X≈0.296, Y∈[0.010..0.100], Z≈0.070, pointing -Y into the intake port.
  const fuelConeMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xff6ec7,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const fuelSprayConeGeo = new THREE.ConeGeometry(0.0095, 0.022, 16, 1, true);
  // Tip at top (+Y/2), opening downward (-Y) into the intake cross-port.
  fuelSprayConeGeo.translate(0, -0.011, 0);
  const fuelSprayCone = new THREE.Mesh(fuelSprayConeGeo, fuelConeMat);
  fuelSprayCone.name = 'Fuel discharge spray cone';
  fuelSprayCone.position.set(0.296, 0.0155, 0.070);
  fuelSprayCone.rotation.x = -0.18; // leans slightly inward toward the intake valve seat
  fuelSprayCone.renderOrder = 958;
  fuelGroup.add(fuelSprayCone);

  const fuelRibbonMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xff6ec7,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  }));
  const fuelDropMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xffc4eb,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  }));

  const fuelStrands = [-1, 1].map((side, idx) => {
    const pts = Array.from({ length: 6 }, () => new THREE.Vector3());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    const ribbon = createDynamicRibbon(20, 5, 0.0014, fuelRibbonMat, `Fuel mist ribbon ${idx}`);
    fuelGroup.add(ribbon.mesh);
    const tracers = Array.from({ length: 3 }, (_, k) => {
      const mesh = new THREE.Mesh(coneGeo, fuelDropMat);
      mesh.name = 'Fuel mist droplet tracer';
      mesh.frustumCulled = false;
      mesh.renderOrder = 968;
      fuelGroup.add(mesh);
      return { mesh, phase: k / 3 + idx * 0.19 };
    });
    return { side, pts, curve, ribbon, tracers };
  });

  // ---------------------------------------------------------------------------
  // 2b. High-pressure 6-jet Direct Diesel Fuel Injector Fan (into omega bowl)
  // ---------------------------------------------------------------------------
  const dieselFuelGroup = new THREE.Group();
  dieselFuelGroup.name = 'Direct diesel fuel injection jets';
  dieselFuelGroup.visible = false;
  fuelGroup.add(dieselFuelGroup);

  const dieselJetMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xff5ec4,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const dieselCoreJetMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xffd2f0,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  // Unit spray cone with tip at origin expanding along +Z (length 1, base radius 0.17).
  const dieselJetGeo = new THREE.ConeGeometry(0.17, 1, 12, 1, true);
  dieselJetGeo.rotateX(-Math.PI / 2); // tip was at +Y -> now tip at -Z; rotate +Math.PI/2 puts tip at +Z? Let's check:
  // Default ConeGeometry: tip at (0, +h/2, 0), base at (0, -h/2, 0).
  // After translate(0, -0.5, 0): tip at (0, 0, 0), base at (0, -1, 0).
  // After rotateX(Math.PI / 2): (0, -1, 0) -> (0, 0, -1); after rotateX(-Math.PI / 2): (0, -1, 0) -> (0, 0, +1)!
  const dieselUnitConeGeo = new THREE.ConeGeometry(0.16, 1, 12, 1, true);
  dieselUnitConeGeo.translate(0, -0.5, 0);
  dieselUnitConeGeo.rotateX(-Math.PI / 2); // Tip at origin (0,0,0), opens outward along +Z so lookAt aims jet cleanly!
  dieselJetGeo.dispose();

  const injectorSpec = landmarks.injector ?? { tip_mm: [229.6, 0, 0], jets: 6, spray_cone_half_angle_deg: 62 };
  const injectorTip = toThree(injectorSpec.tip_mm);
  const jetCount = injectorSpec.jets ?? 6;
  const jetTiltRad = THREE.MathUtils.degToRad(injectorSpec.spray_cone_half_angle_deg ?? 62);
  const dieselJets = Array.from({ length: jetCount }, (_, idx) => {
    const az = (idx / jetCount) * TAU + Math.PI / 6;
    const dir = new THREE.Vector3(
      -Math.cos(jetTiltRad),
      Math.sin(jetTiltRad) * Math.sin(az),
      Math.sin(jetTiltRad) * Math.cos(az),
    ).normalize();
    const plume = new THREE.Mesh(dieselUnitConeGeo, dieselJetMat);
    plume.name = `Diesel direct-injection jet ${idx + 1}`;
    plume.position.copy(injectorTip);
    plume.lookAt(injectorTip.clone().add(dir));
    plume.renderOrder = 966;
    dieselFuelGroup.add(plume);

    const tracers = Array.from({ length: 2 }, (__, k) => {
      const m = new THREE.Mesh(coneGeo, dieselCoreJetMat);
      m.name = 'Diesel fuel jet droplet';
      m.frustumCulled = false;
      m.renderOrder = 972;
      dieselFuelGroup.add(m);
      return { mesh: m, phase: k * 0.5 + idx * 0.11 };
    });
    return { dir, plume, tracers };
  });

  // Cold-start glow plug tip preheat halo (illuminates subtly when GlowPlug is tapped or selected).
  const glowPlugMat = trackMat(new THREE.SpriteMaterial({
    map: sparkTex,
    color: 0xff8a3d,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const glowPlugHalo = new THREE.Sprite(glowPlugMat);
  glowPlugHalo.name = 'Cold-start glow plug heater halo';
  const glowTip = toThree(landmarks.glow_plug?.tip_mm ?? [229.8, 0, 26]);
  glowPlugHalo.position.copy(glowTip);
  glowPlugHalo.visible = false;
  glowPlugHalo.renderOrder = 979;
  chamberGroup.add(glowPlugHalo);

  // ---------------------------------------------------------------------------
  // 2c. Two-Stroke Twin Loop-Scavenging Transfer Ducts + Lower Cylinder / Crankcase Pump
  // ---------------------------------------------------------------------------
  const transferGroup = new THREE.Group();
  transferGroup.name = 'Two-stroke loop-scavenging transfer ducts';
  transferGroup.visible = false;
  fuelGroup.add(transferGroup);

  const transferRibbonMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x2effdc,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    toneMapped: false,
  }));
  const transferConeMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xf0fffc,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    toneMapped: false,
  }));
  // 2 parallel strands on each side (+Z and -Z = 4 strands) tracing bottom -> outside piston -> top dome loop.
  const transferStrands = [-1, 1].flatMap((sideZ, sIdx) =>
    [-1, 1].map((ySpread, jIdx) => {
      const idx = sIdx * 2 + jIdx;
      const pts = Array.from({ length: 9 }, () => new THREE.Vector3());
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
      const ribbon = createDynamicRibbon(32, 6, 0.0022, transferRibbonMat, `Transfer duct ribbon ${idx}`);
      transferGroup.add(ribbon.mesh);
      const tracers = Array.from({ length: 5 }, (_, k) => {
        const m = new THREE.Mesh(coneGeo, transferConeMat);
        m.name = 'Transfer loop-scavenge tracer';
        m.frustumCulled = false;
        m.renderOrder = 972;
        transferGroup.add(m);
        return { mesh: m, phase: k * 0.2 + idx * 0.07 };
      });
      return { sideZ, ySpread, pts, curve, ribbon, tracers };
    }),
  );

  // Translucent pre-charge duct fill boxes inside ±Z transfer ducts (glow as crankcase builds pressure before window opens).
  const prechargeGeo = new THREE.BoxGeometry(1, 1, 1);
  const prechargeMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x2f8cff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const prechargeDucts = [-1, 1].map((sideZ, idx) => {
    const m = new THREE.Mesh(prechargeGeo, prechargeMat);
    m.name = `Transfer duct pre-charge ${idx}`;
    m.visible = false;
    m.renderOrder = 948;
    transferGroup.add(m);
    return { sideZ, mesh: m };
  });

  // Sealed crankcase pre-compression glow drum (aligned along Three.js Z = FreeCAD Y).
  const crankcaseGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false).rotateX(Math.PI / 2);
  const crankcaseMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x38e0ee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const crankcaseGlow = new THREE.Mesh(crankcaseGeo, crankcaseMat);
  crankcaseGlow.name = 'Two-stroke crankcase pre-compression glow';
  crankcaseGlow.visible = false;
  crankcaseGlow.renderOrder = 925;
  chamberGroup.add(crankcaseGlow);

  // Deforming lower-cylinder charge volume beneath the 2-stroke piston (expands & fills on upstroke, compresses on downstroke).
  const lowerChamberOuterMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x38e0ee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }));
  const lowerChamberCoreMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x38e0ee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  // CylinderGeometry along X axis (unit length 1, radius 1 -> scaled dynamically every frame).
  const unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false).rotateZ(Math.PI / 2);
  const lowerChamberOuter = new THREE.Mesh(unitCylGeo, lowerChamberOuterMat);
  lowerChamberOuter.name = 'Two-stroke lower cylinder charge shell';
  lowerChamberOuter.visible = false;
  lowerChamberOuter.renderOrder = 926;
  const lowerChamberCore = new THREE.Mesh(unitCylGeo, lowerChamberCoreMat);
  lowerChamberCore.name = 'Two-stroke lower cylinder charge core';
  lowerChamberCore.visible = false;
  lowerChamberCore.renderOrder = 928;
  chamberGroup.add(lowerChamberOuter, lowerChamberCore);

  // Dedicated kinetic air-fuel particles swirling inside the lower cylinder & crankcase pump.
  const LOWER_PARTICLE_COUNT = 72;
  const lowerPartPositions = new Float32Array(LOWER_PARTICLE_COUNT * 3);
  const lowerPartColors = new Float32Array(LOWER_PARTICLE_COUNT * 3);
  const lowerPartGeo = new THREE.BufferGeometry();
  lowerPartGeo.setAttribute('position', new THREE.BufferAttribute(lowerPartPositions, 3));
  lowerPartGeo.setAttribute('color', new THREE.BufferAttribute(lowerPartColors, 3));
  const lowerPartMat = trackMat(new THREE.PointsMaterial({
    vertexColors: true,
    size: (0.0048) / Math.tan(THREE.MathUtils.degToRad((camera?.fov || 40) / 2)),
    sizeAttenuation: true,
    map: softTex,
    transparent: true,
    opacity: 0.85,
    alphaTest: 0.02,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  }));
  const lowerCloud = new THREE.Points(lowerPartGeo, lowerPartMat);
  lowerCloud.name = 'Two-stroke lower crankcase charge particles';
  lowerCloud.visible = false;
  lowerCloud.frustumCulled = false;
  lowerCloud.renderOrder = 960;
  chamberGroup.add(lowerCloud);

  // ---------------------------------------------------------------------------
  // 3. Deforming Chamber Charge Volume + Expanding Flame Front + Dual Spark Plugs + Kinetic Particles
  // ---------------------------------------------------------------------------
  const chamberOuterMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x38e0ee,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }));
  const chamberCoreMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0x38e0ee,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const chamberOuter = new THREE.Mesh(unitCylGeo, chamberOuterMat);
  chamberOuter.name = 'Deforming chamber charge shell';
  chamberOuter.renderOrder = 930;
  const chamberCore = new THREE.Mesh(unitCylGeo, chamberCoreMat);
  chamberCore.name = 'Deforming chamber charge core';
  chamberCore.renderOrder = 935;
  chamberGroup.add(chamberOuter, chamberCore);

  // Expanding flame front spheres originating from upper & lower spark plugs.
  const flameGeo = new THREE.SphereGeometry(1, 18, 14);
  const flameMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xff7b29,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const flameUpper = new THREE.Mesh(flameGeo, flameMat);
  const flameLower = new THREE.Mesh(flameGeo, flameMat);
  flameUpper.name = 'Upper spark flame front';
  flameLower.name = 'Lower spark flame front';
  flameUpper.renderOrder = 945;
  flameLower.renderOrder = 945;
  chamberGroup.add(flameUpper, flameLower);

  // Dual spark plug electrode flash sprites (UpperSparkPlug Y≈+0.052, LowerSparkPlug Y≈-0.052, X≈0.264).
  const sparkMat = trackMat(new THREE.SpriteMaterial({
    map: sparkTex,
    color: 0xe6f9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const sparkUpper = new THREE.Sprite(sparkMat);
  const sparkLower = new THREE.Sprite(sparkMat);
  sparkUpper.position.set(0.264, 0.048, 0);
  sparkLower.position.set(0.264, -0.048, 0);
  sparkUpper.renderOrder = 980;
  sparkLower.renderOrder = 980;
  chamberGroup.add(sparkUpper, sparkLower);

  // Kinetic charge particles (160 glowing sprites with per-particle vertex colours for air/fuel mixing).
  const PARTICLE_COUNT = 160;
  const partPositions = new Float32Array(PARTICLE_COUNT * 3);
  const partColors = new Float32Array(PARTICLE_COUNT * 3);
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPositions, 3));
  partGeo.setAttribute('color', new THREE.BufferAttribute(partColors, 3));
  const partMat = trackMat(new THREE.PointsMaterial({
    vertexColors: true,
    size: (0.0052) / Math.tan(THREE.MathUtils.degToRad((camera?.fov || 40) / 2)),
    sizeAttenuation: true,
    map: softTex,
    transparent: true,
    opacity: 0.88,
    alphaTest: 0.02,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  }));
  const cloud = new THREE.Points(partGeo, partMat);
  cloud.name = 'Kinetic chamber charge particles';
  cloud.frustumCulled = false;
  cloud.renderOrder = 975;
  chamberGroup.add(cloud);

  // Reusable scratch objects (zero per-frame heap churn).
  const tmpPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpAim = new THREE.Vector3();
  const colIntake = new THREE.Color(0x38e0ee);
  const colCompress = new THREE.Color(0x3b7bff);
  const colPeakComp = new THREE.Color(0x6c63ff);
  const colBurnHot = new THREE.Color(0xffaa33);
  const colPower = new THREE.Color(0xff6b24);
  const colExhaustHot = new THREE.Color(0xe67e45);
  const colExhaustCool = new THREE.Color(0xa69c95);
  const colFuel = new THREE.Color(0xff6ec7);
  const colPremixIntake = new THREE.Color(0x6bd2ff);
  const tmpColor = new THREE.Color();
  const tmpCoreColor = new THREE.Color();
  const tmpMixColor = new THREE.Color();

  group.visible = false;

  const syncLayerVisibility = () => {
    airGroup.visible = layers.air;
    fuelGroup.visible = layers.fuel;
    chamberGroup.visible = layers.chamber;
  };
  syncLayerVisibility();

  function updatePortSystem(sys, portName, lift, degrees, pistonPinMm, tintColor, boost = 0) {
    const active = lift > 0.04;
    sys.portGroup.visible = active;
    if (!active) return;

    const liftFrac = Math.min(1, lift / 2.6);
    sys.ribbonMat.color.copy(tintColor);
    sys.ribbonMat.opacity = Math.min(0.85, 0.14 + 0.34 * liftFrac + boost * 0.24);
    sys.coneMat.opacity = Math.min(1.0, 0.25 + 0.72 * liftFrac + boost * 0.18);

    // Strictly forward scroll: surges at mid-stroke and slows at TDC/BDC with d(scroll)/d(deg) > 0 everywhere.
    const baseScroll = monotonicStrokePhase(degrees, 14);
    const coneWidth = sys.radiusM * (1.25 + 0.55 * liftFrac);
    const coneLen = Math.max(coneWidth * 1.4, 0.0055 * (0.55 + 0.45 * liftFrac));

    for (const strand of sys.strands) {
      const cadPts = buildPortStrandCadMm(portName, strand.offsetZ, lift, pistonPinMm, landmarks);
      for (let i = 0; i < cadPts.length; i++) {
        const v = toThree(cadPts[i]);
        strand.pts[i].copy(v);
      }
      strand.curve.updateArcLengths();
      strand.ribbon.update(strand.curve, sys.radiusM * (0.65 + 0.35 * liftFrac));

      for (const tr of strand.tracers) {
        const u = wrap(baseScroll + tr.phase);
        strand.curve.getPointAt(u, tmpPos);
        strand.curve.getTangentAt(u, tmpTan);
        tr.mesh.position.copy(tmpPos);
        tr.mesh.lookAt(tmpAim.copy(tmpPos).add(tmpTan));
        tr.mesh.scale.set(coneWidth, coneWidth, coneLen);
      }
    }
  }

  function updateFuelSpray(intakeLift, degrees, pistonPinMm, fuelSystem = 'injected', boost = 0) {
    const carburetted = fuelSystem === 'carburetted';
    const openFrac = Math.min(1, intakeLift / 2.2);
    const pulse = 0.85 + 0.15 * Math.sin((degrees * Math.PI) / 45);

    // Port-injected: nozzle cone pulses continuously at FuelDischargeNozzle.
    // Carburetted (illustrative): no port injector spray cone; premixed fuel mist rides in from upstream runner when intake opens.
    fuelSprayCone.visible = !carburetted;
    if (!carburetted) {
      fuelConeMat.opacity = Math.min(0.9, (0.28 + 0.24 * openFrac + boost * 0.25) * pulse);
      fuelSprayCone.scale.set(0.85 + 0.25 * openFrac, 0.85 + 0.35 * openFrac, 0.85 + 0.25 * openFrac);
    }

    const showStrands = !carburetted || openFrac > 0.04;
    for (const strand of fuelStrands) {
      strand.ribbon.mesh.visible = showStrands;
      for (const tr of strand.tracers) tr.mesh.visible = showStrands;
    }
    if (!showStrands) return;

    const pistonCrownM = (pistonPinMm + landmarks.chamber.piston_front_offset_mm) * 0.001;
    const floorM = pistonCrownM + 0.006;
    const baseScroll = monotonicStrokePhase(degrees, carburetted ? 14 : 11);

    fuelRibbonMat.opacity = carburetted
      ? Math.min(0.85, (0.14 + 0.42 * openFrac) + boost * 0.2)
      : Math.min(0.9, 0.24 + 0.42 * openFrac + boost * 0.22);
    fuelDropMat.opacity = carburetted
      ? Math.min(1.0, 0.25 + 0.72 * openFrac)
      : Math.min(1.0, 0.48 + 0.50 * openFrac + boost * 0.15);

    for (const strand of fuelStrands) {
      const yOff = strand.side * 0.0055;
      const liftM = intakeLift * 0.001;
      const reachX = Math.max(floorM, 0.258 - 0.018 * openFrac);
      if (carburetted) {
        // Premixed upstream induction: enters from outside the intake flange (+Z = 0.148 m) alongside the air ribbons.
        strand.pts[0].set(0.296, yOff * 0.9, 0.148);
        strand.pts[1].set(0.296, yOff * 0.9, 0.105);
        strand.pts[2].set(0.296, yOff * 0.8, 0.062);
        strand.pts[3].set(0.286, yOff * 1.1, 0.038);
        strand.pts[4].set(Math.max(floorM, 0.270 - liftM * 0.5), yOff * 1.5, 0.022);
        strand.pts[5].set(reachX, yOff * 2.0, 0.006);
      } else {
        // Starts right at FuelDischargeNozzle tip (0.296, 0.014, 0.070) -> intake cross-port -> valve seat -> chamber when open.
        strand.pts[0].set(0.296, 0.014, 0.070);
        strand.pts[1].set(0.296, 0.004 + yOff * 0.35, 0.068);
        strand.pts[2].set(0.294, -0.002 + yOff * 0.7, 0.056);
        if (openFrac > 0.05) {
          strand.pts[3].set(0.285, yOff * 1.0, 0.042);
          strand.pts[4].set(Math.max(floorM, 0.270 - liftM * 0.5), yOff * 1.4, 0.024);
          strand.pts[5].set(reachX, yOff * 1.9, 0.008);
        } else {
          // Valve closed: mist swirls softly in the port right behind the closed intake valve head.
          const swirl = Math.sin((degrees * Math.PI) / 90) * 0.003;
          strand.pts[3].set(0.291, yOff + swirl, 0.050);
          strand.pts[4].set(0.288, yOff * 1.2 - swirl, 0.046);
          strand.pts[5].set(0.286, yOff * 0.5 + swirl, 0.043);
        }
      }
      strand.curve.updateArcLengths();
      strand.ribbon.update(strand.curve, (carburetted ? 0.0014 : 0.0011) + 0.0005 * openFrac);

      const dropW = 0.0019 + 0.0009 * openFrac;
      const dropL = 0.0038 + 0.0022 * openFrac;
      for (const tr of strand.tracers) {
        const u = wrap(baseScroll + tr.phase);
        strand.curve.getPointAt(u, tmpPos);
        strand.curve.getTangentAt(u, tmpTan);
        tr.mesh.position.copy(tmpPos);
        tr.mesh.lookAt(tmpAim.copy(tmpPos).add(tmpTan));
        tr.mesh.scale.set(dropW, dropW, dropL);
      }
    }
  }

  function updateDieselFuelSpray(state, degrees, boost = 0) {
    // Hide Otto port injector visuals when running Diesel compression-ignition.
    fuelSprayCone.visible = false;
    for (const strand of fuelStrands) {
      strand.ribbon.mesh.visible = false;
      for (const tr of strand.tracers) tr.mesh.visible = false;
    }

    const intensity = Math.max(state.injectionIntensity || 0, boost > 0 ? 0.38 : 0);
    const active = intensity > 0.03;
    dieselFuelGroup.visible = active;
    if (!active) return;

    const pulse = 0.88 + 0.12 * Math.sin((degrees * Math.PI) / 14);
    const jetLen = (0.011 + 0.017 * intensity) * pulse;
    const jetWidth = jetLen * (0.95 + 0.25 * intensity);
    dieselJetMat.opacity = Math.min(0.92, (0.28 + 0.56 * intensity + boost * 0.2) * pulse);
    dieselCoreJetMat.opacity = Math.min(1.0, 0.4 + 0.6 * intensity);

    const scroll = monotonicStrokePhase(degrees, 26);
    for (const jet of dieselJets) {
      jet.plume.scale.set(jetWidth, jetWidth, jetLen);
      for (const tr of jet.tracers) {
        const u = 0.15 + 0.82 * wrap(scroll + tr.phase);
        tmpPos.copy(injectorTip).addScaledVector(jet.dir, jetLen * u);
        tr.mesh.position.copy(tmpPos);
        tr.mesh.lookAt(tmpAim.copy(tmpPos).add(jet.dir));
        const w = 0.0014 + 0.0009 * intensity;
        tr.mesh.scale.set(w, w, 0.0038 + 0.002 * intensity);
      }
    }
  }

  function updateTwoStrokePorts(state, degrees, intakeBoost = 0, exhaustBoost = 0) {
    const baseScroll = monotonicStrokePhase(degrees * 2, 14);

    // 1. Crankcase intake port (-Y, X = 90) -> pulls fresh premix into crankcase beneath rising piston
    const inOpen = state.intakePortOpen || 0;
    const inActive = inOpen > 0.04;
    intakeSys.portGroup.visible = inActive;
    if (inActive) {
      intakeSys.ribbonMat.color.copy(colPremixIntake);
      intakeSys.ribbonMat.opacity = Math.min(0.85, 0.18 + 0.42 * inOpen + intakeBoost * 0.24);
      intakeSys.coneMat.opacity = Math.min(1.0, 0.35 + 0.62 * inOpen);
      const coneW = 0.0028 * (0.85 + 0.4 * inOpen);
      const coneL = 0.0052 * (0.7 + 0.35 * inOpen);
      for (const strand of intakeSys.strands) {
        const zMm = strand.offsetZ * 4.5;
        const cadPts = [
          [90, -96, zMm],
          [90, -76, zMm],
          [90, -56, zMm],
          [88, -38, zMm],
          [76, -24, zMm * 1.2],
          [56, -12, zMm * 1.4],
          [38, -2, zMm * 1.4],
          [24, 6, zMm * 1.2],
        ];
        for (let i = 0; i < cadPts.length; i++) strand.pts[i].copy(toThree(cadPts[i]));
        strand.curve.updateArcLengths();
        strand.ribbon.update(strand.curve, 0.002 * (0.7 + 0.35 * inOpen));
        for (const tr of strand.tracers) {
          const u = wrap(baseScroll + tr.phase);
          strand.curve.getPointAt(u, tmpPos);
          strand.curve.getTangentAt(u, tmpTan);
          tr.mesh.position.copy(tmpPos);
          tr.mesh.lookAt(tmpAim.copy(tmpPos).add(tmpTan));
          tr.mesh.scale.set(coneW, coneW, coneL);
        }
      }
    }

    // 2. Exhaust port (+Y, X = 120.5) -> hot blowdown + scavenged exhaust out of cylinder
    const exOpen = state.exhaustPortOpen || 0;
    const exActive = exOpen > 0.04;
    exhaustSys.portGroup.visible = exActive;
    if (exActive) {
      const blowdownHot = state.angle >= 100 && state.angle < 155 ? 1 - (state.angle - 100) / 55 : 0;
      tmpColor.copy(colExhaustCool).lerp(colExhaustHot, blowdownHot);
      exhaustSys.ribbonMat.color.copy(tmpColor);
      exhaustSys.ribbonMat.opacity = Math.min(0.88, 0.2 + 0.42 * exOpen + exhaustBoost * 0.24);
      exhaustSys.coneMat.opacity = Math.min(1.0, 0.35 + 0.62 * exOpen);
      const coneW = 0.0026 * (0.85 + 0.4 * exOpen);
      const coneL = 0.0052 * (0.7 + 0.35 * exOpen);
      for (const strand of exhaustSys.strands) {
        const zMm = strand.offsetZ * 5.0;
        const cadPts = [
          [148, -6, zMm * 1.4],
          [142, 8, zMm * 1.3],
          [130, 22, zMm * 1.1],
          [122, 34, zMm],
          [120.5, 48, zMm],
          [120.5, 64, zMm],
          [120.5, 82, zMm],
          [120.5, 100, zMm],
        ];
        for (let i = 0; i < cadPts.length; i++) strand.pts[i].copy(toThree(cadPts[i]));
        strand.curve.updateArcLengths();
        strand.ribbon.update(strand.curve, 0.0021 * (0.7 + 0.35 * exOpen));
        for (const tr of strand.tracers) {
          const u = wrap(baseScroll + tr.phase);
          strand.curve.getPointAt(u, tmpPos);
          strand.curve.getTangentAt(u, tmpTan);
          tr.mesh.position.copy(tmpPos);
          tr.mesh.lookAt(tmpAim.copy(tmpPos).add(tmpTan));
          tr.mesh.scale.set(coneW, coneW, coneL);
        }
      }
    }
  }

  function updateTwoStrokeTransfer(state, degrees, boost = 0) {
    // Hide Otto & Diesel fuel sprays
    fuelSprayCone.visible = false;
    dieselFuelGroup.visible = false;
    for (const strand of fuelStrands) {
      strand.ribbon.mesh.visible = false;
      for (const tr of strand.tracers) tr.mesh.visible = false;
    }

    const spec = landmarks.transfer_ducts ?? { z_offset_mm: 44.5, lower_x_mm: 54, window_x_mm: 115, loop_apex_x_mm: 162 };
    const trOpen = state.transferPortOpen || 0;
    const pCc = state.crankcasePressure ?? 1.0;
    const prechargeNorm = trOpen <= 0.04 && state.angle > 15 && state.angle < 130 ? Math.max(0, Math.min(1, (pCc - 1.02) / 0.34)) : 0;
    const streamActive = trOpen > 0.04;
    const anyActive = streamActive || prechargeNorm > 0.05;
    transferGroup.visible = anyActive;
    if (!anyActive) return;

    // Show pressurized blue charge building inside the ±Z transfer ducts right behind the descending piston skirt!
    const ductSpanMm = Math.max(24, (spec.window_x_mm - 5) - spec.lower_x_mm);
    const ductMidX = (spec.lower_x_mm + (spec.window_x_mm - 5)) * 0.5;
    for (const d of prechargeDucts) {
      d.mesh.visible = prechargeNorm > 0.05 || streamActive;
      // CAD (x, y, z) -> Three.js (x, z, -y)
      d.mesh.position.set(ductMidX * 0.001, d.sideZ * spec.z_offset_mm * 0.001, 0);
      d.mesh.scale.set(ductSpanMm * 0.001, 0.007, 0.015);
    }
    prechargeMat.color.copy(streamActive ? colIntake : colCompress);
    prechargeMat.opacity = streamActive ? 0.24 * trOpen : 0.34 * prechargeNorm;

    for (const strand of transferStrands) {
      strand.ribbon.mesh.visible = streamActive;
      for (const tr of strand.tracers) tr.mesh.visible = streamActive;
    }
    if (!streamActive) return;

    transferRibbonMat.opacity = Math.min(0.92, 0.32 + 0.48 * trOpen + boost * 0.18);
    transferConeMat.opacity = Math.min(1.0, 0.45 + 0.55 * trOpen);
    const scroll = monotonicStrokePhase(degrees * 2, 18);
    const coneW = 0.0026 * (0.88 + 0.35 * trOpen);
    const coneL = 0.0056 * (0.78 + 0.3 * trOpen);

    for (const strand of transferStrands) {
      const zOut = strand.sideZ * spec.z_offset_mm;
      const zMid = strand.sideZ * 25;
      const zIn = strand.sideZ * 9;
      const yOff = strand.ySpread * 4.2;
      // Full unmistakable Schnürle loop:
      // Under piston (crankcase) -> out into side bypass duct -> straight up OUTSIDE piston skirt ->
      // inward through open transfer window ABOVE piston crown -> loops up back wall (-Y) to dome -> sweeps toward exhaust (+Y)!
      const cadPts = [
        [36, yOff * 0.9 - 2, strand.sideZ * 18],
        [52, yOff * 0.9 - 3, strand.sideZ * 36],
        [68, yOff * 0.8 - 2, zOut],
        [92, yOff * 0.8 - 2, zOut],
        [spec.window_x_mm - 2, yOff * 0.8 - 4, zOut * 0.95],
        [spec.window_x_mm + 4, yOff * 0.9 - 10, zMid],
        [spec.window_x_mm + 24, yOff * 0.8 - 15, zIn * 1.4],
        [spec.loop_apex_x_mm, yOff * 0.6 - 6, zIn * 0.8],
        [spec.loop_apex_x_mm - 10, yOff * 0.5 + 14, zIn * 0.5],
      ];
      for (let i = 0; i < cadPts.length; i++) strand.pts[i].copy(toThree(cadPts[i]));
      strand.curve.updateArcLengths();
      strand.ribbon.update(strand.curve, 0.0021 * (0.78 + 0.3 * trOpen));
      for (const tr of strand.tracers) {
        const u = wrap(scroll + tr.phase);
        strand.curve.getPointAt(u, tmpPos);
        strand.curve.getTangentAt(u, tmpTan);
        tr.mesh.position.copy(tmpPos);
        tr.mesh.lookAt(tmpAim.copy(tmpPos).add(tmpTan));
        tr.mesh.scale.set(coneW, coneW, coneL);
      }
    }
  }

  function updateChamber(state, degrees, pistonPinMm, sparkFocus = false, glowFocus = false, cycleType = 'otto') {
    const isDiesel = cycleType === 'diesel';
    const isTwoStroke = cycleType === 'two-stroke';
    const chamber = landmarks.chamber;
    const boreRadiusMm = chamber.bore_radius_mm ?? 51;
    const pistonCrownMm = pistonPinMm + chamber.piston_front_offset_mm;
    const bowlInset = isDiesel ? Math.min(7, (chamber.bowl_depth_mm ?? 12) * 0.5) : 0;
    const lowerMm = pistonCrownMm + (isDiesel ? -bowlInset : 2.5);
    const upperMm = chamber.front_x_mm + (isDiesel ? 1.2 : isTwoStroke ? 1.5 : 2.5);
    const lengthMm = Math.max(4, upperMm - lowerMm);
    const centerX = ((lowerMm + upperMm) * 0.5) * 0.001;
    const radiusM = boreRadiusMm * 0.001;

    // Two-stroke bottom-half animated fill & crankcase pre-compression volume (crankcase + lower bore beneath piston)
    if (isTwoStroke) {
      const cc = landmarks.crankcase ?? { center_x_mm: 12, radius_mm: 48, length_mm: 52 };
      const pCc = state.crankcasePressure ?? 1.0;
      const inOpen = state.intakePortOpen || 0;
      // 0 = fresh suction fill (bright cyan-teal), 1 = peak crankcase pre-compression (electric cobalt-blue)
      const compNorm = Math.max(0, Math.min(1, (pCc - 0.92) / 0.42));
      const fillNorm = Math.max(0, Math.min(1, (pistonPinMm - 80) / 64)); // 0 at BDC, 1 at TDC (maximum lower-cylinder volume!)

      tmpMixColor.copy(colIntake).lerp(colCompress, compNorm * 0.92);
      if (compNorm > 0.65) tmpMixColor.lerp(colPeakComp, (compNorm - 0.65) / 0.35);

      // 1. Sealed crankcase drum glow
      crankcaseGlow.visible = true;
      crankcaseGlow.position.set(cc.center_x_mm * 0.001, 0, 0);
      crankcaseGlow.scale.set(cc.radius_mm * 0.001, cc.radius_mm * 0.001, cc.length_mm * 0.001);
      crankcaseMat.color.copy(tmpMixColor);
      crankcaseMat.opacity = 0.11 + 0.14 * compNorm + 0.08 * inOpen;

      // 2. Deforming lower-cylinder charge beneath the moving piston (X = 44 mm up to piston underside)
      const lowerBaseMm = 44.0;
      const lowerTopMm = Math.max(lowerBaseMm + 8, pistonPinMm + 10.0);
      const lowerLenMm = lowerTopMm - lowerBaseMm;
      const lowerCenterX = ((lowerBaseMm + lowerTopMm) * 0.5) * 0.001;
      const lowerRadM = Math.max(0.028, (boreRadiusMm - 1.0) * 0.001);
      lowerChamberOuter.visible = true;
      lowerChamberCore.visible = true;
      lowerChamberOuter.position.set(lowerCenterX, 0, 0);
      lowerChamberOuter.scale.set(lowerLenMm * 0.001, lowerRadM, lowerRadM);
      lowerChamberCore.position.set(lowerCenterX, 0, 0);
      lowerChamberCore.scale.set(lowerLenMm * 0.00086, lowerRadM * 0.68, lowerRadM * 0.68);
      lowerChamberOuterMat.color.copy(tmpMixColor);
      lowerChamberCoreMat.color.copy(tmpMixColor).lerp(colPremixIntake, inOpen * 0.45);
      lowerChamberOuterMat.opacity = 0.14 + 0.14 * fillNorm + 0.16 * compNorm;
      lowerChamberCoreMat.opacity = 0.09 + 0.12 * fillNorm + 0.22 * compNorm;

      // 3. Swirling kinetic air-fuel particles filling and compressing inside the bottom half of the cylinder + crankcase
      lowerCloud.visible = true;
      const lpPhase = wrap(degrees / 360);
      const lpOrbit = TAU * lpPhase * 1.6;
      const lpMinX = 18;
      const lpMaxX = lowerTopMm - 4;
      for (let i = 0; i < LOWER_PARTICLE_COUNT; i++) {
        const seed = (i + 0.5) / LOWER_PARTICLE_COUNT;
        const theta = i * 2.399963229728653 - lpOrbit;
        const rMm = (boreRadiusMm - 4) * Math.sqrt(seed) * (0.84 + 0.12 * Math.sin(lpOrbit + i));
        const axial = 0.5 + 0.46 * Math.sin(TAU * wrap(i * 0.61803398875) + lpOrbit * 1.8);
        const xMm = lpMinX + (lpMaxX - lpMinX) * axial;
        const yMm = rMm * Math.cos(theta);
        const zMm = rMm * Math.sin(theta);
        lowerPartPositions[i * 3] = xMm * 0.001;
        lowerPartPositions[i * 3 + 1] = zMm * 0.001;
        lowerPartPositions[i * 3 + 2] = -yMm * 0.001;

        const isPremixDot = i % 4 === 0;
        if (isPremixDot) {
          tmpColor.copy(colFuel).lerp(tmpMixColor, 0.25 + 0.35 * compNorm);
        } else {
          tmpColor.copy(tmpMixColor);
        }
        lowerPartColors[i * 3] = tmpColor.r;
        lowerPartColors[i * 3 + 1] = tmpColor.g;
        lowerPartColors[i * 3 + 2] = tmpColor.b;
      }
      lowerPartGeo.attributes.position.needsUpdate = true;
      lowerPartGeo.attributes.color.needsUpdate = true;
      lowerPartMat.opacity = 0.68 + 0.26 * Math.max(fillNorm, compNorm);
    } else {
      crankcaseGlow.visible = false;
      lowerChamberOuter.visible = false;
      lowerChamberCore.visible = false;
      lowerCloud.visible = false;
    }

    // Compute vivid, physically meaningful gas colour from thermodynamic state (P, T, burnFraction).
    const { angle, combustionGlow, burnFraction, strokeIndex, sparkIntensity } = state;
    const compHeat = state.compressionHeat || 0;
    if (strokeIndex === 0) {
      tmpColor.copy(colIntake);
      tmpCoreColor.copy(colIntake);
      chamberOuterMat.opacity = 0.15;
      chamberCoreMat.opacity = 0.09;
    } else if (strokeIndex === 1) {
      const compT = isTwoStroke
        ? Math.max(0, Math.min(1, (angle - 220) / 140))
        : Math.max(0, Math.min(1, (angle - 180) / 180));
      tmpColor.copy(colIntake).lerp(colCompress, Math.min(1, compT * 1.15));
      if (compT > 0.65) tmpColor.lerp(colPeakComp, (compT - 0.65) / 0.35);
      // In Diesel, 17.5:1 pure-air compression heats the charge dramatically toward auto-ignition amber!
      if (isDiesel && compHeat > 0.25) {
        tmpColor.lerp(colBurnHot, Math.min(0.65, (compHeat - 0.25) * 0.85));
      }
      if (burnFraction > 0.01) tmpColor.lerp(colBurnHot, Math.min(1, burnFraction * 1.4));
      tmpCoreColor.copy(tmpColor).lerp(colBurnHot, Math.max(burnFraction, isDiesel ? compHeat * 0.55 : 0));
      chamberOuterMat.opacity = 0.16 + 0.18 * compT + 0.12 * burnFraction + (isDiesel ? 0.08 * compHeat : 0);
      chamberCoreMat.opacity = 0.10 + 0.22 * compT + 0.28 * burnFraction + (isDiesel ? 0.16 * compHeat : 0);
    } else if (strokeIndex === 2) {
      const coolT = isTwoStroke
        ? Math.max(0, Math.min(1, (angle < 180 ? angle : 0) / 115))
        : Math.max(0, Math.min(1, (angle - 370) / 170));
      tmpColor.copy(colBurnHot).lerp(colPower, Math.min(1, coolT * 1.2));
      if (coolT > 0.7) tmpColor.lerp(colExhaustHot, (coolT - 0.7) / 0.3);
      tmpCoreColor.copy(colBurnHot).lerp(colPower, coolT);
      chamberOuterMat.opacity = 0.18 + 0.24 * combustionGlow;
      chamberCoreMat.opacity = 0.12 + 0.38 * combustionGlow;
    } else {
      const exhT = isTwoStroke ? 0.3 : Math.max(0, Math.min(1, (angle - 540) / 180));
      tmpColor.copy(colExhaustHot).lerp(colExhaustCool, Math.min(1, exhT * 1.3));
      tmpCoreColor.copy(tmpColor);
      chamberOuterMat.opacity = 0.17 * (1 - 0.35 * exhT);
      chamberCoreMat.opacity = 0.06 * (1 - 0.5 * exhT);
    }

    chamberOuterMat.color.copy(tmpColor);
    chamberCoreMat.color.copy(tmpCoreColor);
    chamberOuter.position.set(centerX, 0, 0);
    chamberOuter.scale.set(lengthMm * 0.001, radiusM, radiusM);
    chamberCore.position.set(centerX, 0, 0);
    chamberCore.scale.set(lengthMm * 0.00088, radiusM * 0.66, radiusM * 0.66);

    // Flame front & spark/glow cues per cycle type.
    const flameActive = isTwoStroke
      ? (combustionGlow > 0.04 && (angle >= 340 || angle <= 110))
      : (combustionGlow > 0.04 && (angle >= 338 && angle <= 485));

    if (isDiesel) {
      flameUpper.visible = flameActive;
      flameLower.visible = false;
      if (flameActive) {
        const expand = Math.max(0.24, Math.pow(Math.max(0.1, burnFraction), 0.5));
        const flameR = (0.009 + 0.022 * expand) * (boreRadiusMm / 36);
        const bowlCenterX = Math.max((lowerMm + 3) * 0.001, (pistonCrownMm - 2.5) * 0.001);
        flameUpper.position.set(bowlCenterX, 0, 0);
        flameUpper.scale.set(Math.min(flameR * 0.7, lengthMm * 0.0005), flameR, flameR);
        flameMat.color.copy(colBurnHot).lerp(colPower, Math.max(0, 1 - combustionGlow));
        flameMat.opacity = Math.min(0.68, combustionGlow * 0.72);
      }
      sparkUpper.visible = false;
      sparkLower.visible = false;
      glowPlugHalo.visible = glowFocus;
      if (glowFocus) {
        const pulse = 0.78 + 0.22 * Math.sin((degrees * Math.PI) / 45);
        glowPlugMat.opacity = 0.85 * pulse;
        const gs = 0.015 + 0.005 * pulse;
        glowPlugHalo.scale.set(gs, gs, 1);
      }
    } else if (isTwoStroke) {
      glowPlugHalo.visible = false;
      flameUpper.visible = flameActive;
      flameLower.visible = false;
      const tip = toThree(landmarks.spark_plug?.tip_mm ?? [184, 0, 0]);
      if (flameActive) {
        const expand = state.mode === 'practical' ? Math.max(0.22, Math.pow(Math.max(0.1, burnFraction), 0.5)) : 1.0;
        const flameR = (0.008 + 0.022 * expand) * (boreRadiusMm / 34);
        flameUpper.position.set(Math.max((lowerMm + 3) * 0.001, tip.x - 0.008 * expand), 0, 0);
        flameUpper.scale.set(Math.min(flameR * 0.65, lengthMm * 0.00048), flameR, flameR);
        flameMat.color.copy(colBurnHot).lerp(colPower, Math.max(0, 1 - combustionGlow));
        flameMat.opacity = Math.min(0.66, combustionGlow * 0.7);
      }
      const effectiveSpark = sparkFocus ? Math.max(sparkIntensity, 0.36) : sparkIntensity;
      const showSpark = effectiveSpark > 0.04;
      sparkUpper.visible = showSpark;
      sparkLower.visible = false;
      if (showSpark) {
        sparkUpper.position.copy(tip);
        sparkMat.opacity = Math.min(1, effectiveSpark * 1.15);
        const s = 0.015 + 0.022 * effectiveSpark;
        sparkUpper.scale.set(s, s, 1);
      }
    } else {
      glowPlugHalo.visible = false;
      flameUpper.visible = flameActive;
      flameLower.visible = flameActive;
      if (flameActive) {
        const expand = state.mode === 'practical' ? Math.max(0.18, Math.pow(burnFraction, 0.55)) : 1.0;
        const flameR = 0.010 + 0.036 * expand;
        const flameX = Math.max((lowerMm + 4) * 0.001, 0.262 - 0.012 * expand);
        const yOffset = 0.038 * (1 - 0.55 * expand);
        flameUpper.position.set(flameX, yOffset, 0);
        flameLower.position.set(flameX, -yOffset, 0);
        flameUpper.scale.set(Math.min(flameR, lengthMm * 0.00048), flameR, flameR);
        flameLower.scale.set(Math.min(flameR, lengthMm * 0.00048), flameR, flameR);
        flameMat.color.copy(colBurnHot).lerp(colPower, Math.max(0, 1 - combustionGlow));
        flameMat.opacity = Math.min(0.62, combustionGlow * 0.65);
      }

      // Dual spark plug electrode flash sprites (keep gentle electrode halo when a spark plug part is selected).
      const effectiveSpark = sparkFocus ? Math.max(sparkIntensity, 0.36) : sparkIntensity;
      const showSpark = effectiveSpark > 0.04;
      sparkUpper.visible = showSpark;
      sparkLower.visible = showSpark;
      if (showSpark) {
        sparkUpper.position.set(0.264, 0.048, 0);
        sparkLower.position.set(0.264, -0.048, 0);
        sparkMat.opacity = Math.min(1, effectiveSpark * 1.15);
        const s = 0.015 + 0.022 * effectiveSpark;
        sparkUpper.scale.set(s, s, 1);
        sparkLower.scale.set(s, s, 1);
      }
    }

    // Kinetic charge particles: strictly monotonic tumble/swirl phase + thermal jitter so expansion never reverses swirl.
    const phase = wrap(degrees / (isTwoStroke ? 360 : 720));
    const rad = (degrees * Math.PI) / 180;
    const orbit = TAU * (phase * 1.45 - Math.sin(2 * rad) / (8 * Math.PI));
    const jitterAmp = 0.24 + 0.14 * Math.min(2, Math.sqrt(Math.max(1, state.temperature)) - 1);
    const pLower = lowerMm + 2;
    const pUpper = Math.max(pLower + 2, upperMm - 2.5);
    const maxR = Math.max(18, boreRadiusMm - 4); // mm

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = (i + 0.5) / PARTICLE_COUNT;
      const theta = i * 2.399963229728653 + orbit + Math.sin(orbit * 1.4 + i) * jitterAmp;
      const radMm = maxR * Math.sqrt(seed) * (0.82 + 0.14 * Math.sin(orbit * 1.5 + i * 1.7));
      const axial = 0.5 + 0.45 * Math.sin(TAU * wrap(i * 0.61803398875) + orbit * 2.1);
      const xMm = pLower + (pUpper - pLower) * axial;
      const yMm = radMm * Math.cos(theta);
      const zMm = radMm * Math.sin(theta);
      // CAD (x, y, z) -> Three.js (x, z, -y) * 0.001
      partPositions[i * 3] = xMm * 0.001;
      partPositions[i * 3 + 1] = zMm * 0.001;
      partPositions[i * 3 + 2] = -yMm * 0.001;

      // Otto & 2-Stroke mix fuel droplets during intake/compression; Diesel compresses pure air until direct injection!
      const isFuelDroplet = isDiesel
        ? (state.injectionIntensity > 0.05 && i % 4 === 0)
        : (i % 5 === 0 && (strokeIndex === 0 || (strokeIndex === 1 && burnFraction < 0.25)));
      if (isFuelDroplet) {
        tmpMixColor.copy(colFuel).lerp(tmpColor, isDiesel ? 0.15 : (strokeIndex === 1 ? 0.35 : 0.05));
      } else {
        tmpMixColor.copy(tmpColor).lerp(colBurnHot, Math.max(combustionGlow * 0.45, isDiesel ? compHeat * 0.35 : 0));
      }
      partColors[i * 3] = tmpMixColor.r;
      partColors[i * 3 + 1] = tmpMixColor.g;
      partColors[i * 3 + 2] = tmpMixColor.b;
    }
    partGeo.attributes.position.needsUpdate = true;
    partGeo.attributes.color.needsUpdate = true;
    partMat.opacity = 0.72 + 0.26 * Math.min(1, combustionGlow + (strokeIndex === 1 ? 0.18 : 0));
  }

  return {
    setVisible(value) {
      group.visible = value;
    },
    setLayers(next) {
      if (next.air !== undefined) layers.air = Boolean(next.air);
      if (next.fuel !== undefined) layers.fuel = Boolean(next.fuel);
      if (next.chamber !== undefined) layers.chamber = Boolean(next.chamber);
      syncLayerVisibility();
    },
    setClippingPlane(plane) {
      activeClipPlanes = plane ? [plane] : [];
      for (const mat of materials) {
        const had = Boolean(mat.clippingPlanes?.length);
        mat.clippingPlanes = activeClipPlanes;
        if (had !== Boolean(plane)) mat.needsUpdate = true;
      }
    },
    update(degrees, pistonPinMm, mode = 'ideal', fuelSystem = 'injected', emphasisPartId = '', cycleType = 'otto') {
      const state = cycleCueState(degrees, mode, cycleType);
      if (group.visible) {
        const isDiesel = cycleType === 'diesel';
        const isTwoStroke = cycleType === 'two-stroke';
        const intakeBoost = /Intake/i.test(emphasisPartId) ? 1 : 0;
        const exhaustBoost = /Exhaust/i.test(emphasisPartId) ? 1 : 0;
        const fuelBoost = /FuelDischargeNozzle|DirectFuelInjector|CylinderBarrel|CrankcaseHousing/i.test(emphasisPartId) ? 1 : 0;
        const sparkFocus = !isDiesel && /SparkPlug|SparkInsulator|SparkTerminal/i.test(emphasisPartId);
        const glowFocus = isDiesel && /GlowPlug/i.test(emphasisPartId);
        if (layers.air) {
          if (isTwoStroke) {
            updateTwoStrokePorts(state, degrees, intakeBoost, exhaustBoost);
          } else {
            const intakeTint = !isDiesel && fuelSystem === 'carburetted' ? colPremixIntake : colIntake;
            updatePortSystem(intakeSys, 'intake', state.intakeLift, degrees, pistonPinMm, intakeTint, intakeBoost);
            const blowdownHot = state.angle >= 500 && state.angle < 580 ? 1 - (state.angle - 500) / 80 : 0;
            tmpColor.copy(colExhaustCool).lerp(colExhaustHot, blowdownHot);
            updatePortSystem(exhaustSys, 'exhaust', state.exhaustLift, degrees, pistonPinMm, tmpColor, exhaustBoost);
          }
        }
        if (layers.fuel) {
          if (isTwoStroke) {
            updateTwoStrokeTransfer(state, degrees, fuelBoost);
          } else if (isDiesel) {
            transferGroup.visible = false;
            updateDieselFuelSpray(state, degrees, fuelBoost);
          } else {
            transferGroup.visible = false;
            dieselFuelGroup.visible = false;
            updateFuelSpray(state.intakeLift, degrees, pistonPinMm, fuelSystem, fuelBoost);
          }
        }
        if (layers.chamber) {
          updateChamber(state, degrees, pistonPinMm, sparkFocus, glowFocus, cycleType);
        }
      }
      return state;
    },
    dispose() {
      scene.remove(group);
      const geometries = new Set();
      group.traverse((obj) => {
        if (obj.geometry) geometries.add(obj.geometry);
      });
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
      softTex.dispose();
      sparkTex.dispose();
    },
  };
}
