import * as THREE from 'three';
import type { ModelDefinition } from '../../data/modelRegistry';
import { groupComponentIds } from '../core/component-groups.mjs';
import { loadGltf } from '../core/assets';
import { createSectionController, disposeObject } from '../core/modelUtils';
import { mechanismPose } from '../engineering/kinematics.mjs';
import { valveMatrices } from '../engineering/valve-transforms.mjs';
import { createCycleVisuals } from '../engineering/cycle-visuals.mjs';
import type { AdapterContext, AppearanceMode, ModelComponent, ModelGroup, ViewerSession, ViewerSnapshot } from '../types';

type MotionEntry = { mesh: THREE.Mesh; group: 'Piston' | 'ConnectingRod' | 'Crank' | 'Cylinder'; localBind: THREE.Matrix4 };

function componentGroup(id: string) {
  if (id.startsWith('Intake') || id === 'FuelDischargeNozzle') return 'intake';
  if (id.startsWith('Exhaust')) return 'exhaust';
  if (/Spark/.test(id)) return 'ignition';
  if (/^(Piston|FloatingPin|PinPlug)/.test(id)) return 'piston';
  if (/^Cylinder/.test(id)) return 'structure';
  return 'crank';
}

function inspectionMaterial(id: string) {
  let color = 0x9cabb8;
  if (/Intake|FuelDischargeNozzle/i.test(id)) color = 0x379e9b;
  else if (/Exhaust/i.test(id)) color = 0xbc7353;
  else if (/Seal|Gasket/i.test(id)) color = 0x364451;
  else if (/Ring|Bolt|Nut|Crank/i.test(id)) color = 0x596d80;
  else if (/Insulator/i.test(id)) color = 0xe2dbca;
  else if (/Piston|Pin/i.test(id)) color = 0xc2ced6;
  return new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.48 });
}

function groupMatrices(degrees: number, profile: any) {
  const pose = mechanismPose(degrees, profile.radius_m, profile.rod_length_m);
  return {
    Piston: new THREE.Matrix4().makeTranslation(pose.piston[0], pose.piston[1], pose.piston[2]),
    ConnectingRod: new THREE.Matrix4().makeRotationZ(pose.rodAngle).setPosition(pose.rod[0], pose.rod[1], pose.rod[2]),
    Crank: new THREE.Matrix4().makeRotationZ(pose.crankAngle),
    Cylinder: new THREE.Matrix4(),
  };
}

export async function createCylinderSession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  const { runtime, signal, onChange, onProgress } = context;
  const [catalogueResponse, motionResponse, loaded] = await Promise.all([
    fetch(definition.componentCatalogueUrl!, { signal }),
    fetch(definition.motionProfileUrl!, { signal }),
    loadGltf(definition.sources || [], signal, onProgress),
  ]);
  if (!catalogueResponse.ok) throw Error('The cylinder component catalogue is unavailable.');
  if (!motionResponse.ok) throw Error('The cylinder motion profile is unavailable.');
  const catalogue = await catalogueResponse.json();
  const motionProfile = await motionResponse.json();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', loaded.bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== motionProfile.asset_sha256) throw Error('This cylinder asset does not match its verified motion profile.');
  signal.throwIfAborted();

  const root = loaded.gltf.scene;
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    let node: THREE.Object3D | null = mesh;
    let id: string | undefined;
    while (node && !id) { id = node.userData.cad_part_id; node = node.parent; }
    mesh.userData.partId = id;
    meshes.push(mesh);
  });
  const expectedIds = new Set<string>(catalogue.parts.map((part: any) => part.cad_stable_id));
  const actualIds = new Set<string>(meshes.map((mesh) => mesh.userData.partId));
  if (expectedIds.size !== catalogue.parts.length || actualIds.size !== expectedIds.size || [...actualIds].some((id) => !expectedIds.has(id))) {
    throw Error('The operating cylinder components do not match its catalogue.');
  }
  const motionGroups = new Set(['Piston', 'ConnectingRod', 'Crank', 'Cylinder']);
  if (meshes.some((mesh) => !motionGroups.has(motionProfile.groups[mesh.userData.partId]))) throw Error('The cylinder motion profile is missing a component group.');
  if (motionProfile.valves && motionProfile.bind_angle_deg !== 0) throw Error('Valve motion requires the verified closed zero-degree bind pose.');
  for (const [id, spring] of Object.entries(motionProfile.valves?.spring_targets || {}) as [string, any][]) {
    const mesh = meshes.find((candidate) => candidate.userData.partId === id);
    if (!mesh || mesh.morphTargetDictionary?.[spring.target] === undefined) throw Error(`The cylinder spring shape key is missing: ${id}.`);
  }

  const catalogueById = new Map<string, any>(catalogue.parts.map((part: any) => [part.cad_stable_id, part]));
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const inspection = new Map<THREE.Mesh, THREE.Material>();
  for (const mesh of meshes) {
    originals.set(mesh, mesh.material);
    inspection.set(mesh, inspectionMaterial(mesh.userData.partId));
  }
  const highlight = new THREE.MeshStandardMaterial({ color: 0x39e4c4, emissive: 0x063e38, emissiveIntensity: 0.7, metalness: 0.45, roughness: 0.3 });
  const ghost = new THREE.MeshStandardMaterial({ color: 0x9cbdcf, transparent: true, opacity: 0.12, depthWrite: false });

  runtime.scene.add(root);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  runtime.fit(root);

  const snapshot: ViewerSnapshot = {
    status: 'Operating cylinder ready',
    progress: 100,
    appearance: 'inspection',
    angle: motionProfile.bind_angle_deg,
    playing: false,
    motionNote: '',
    cycleEnabled: Boolean(context.initialCycle),
    sectionEnabled: false,
    sectionAxis: 'z',
    sectionPosition: 50,
    sectionFlipped: true,
  };

  let selectedId = '';
  let isolated = false;
  const isolatedParts = new Set<string>();
  const focusSet = new Set(context.focusParts || []);
  let playing = false;
  let cycleEnabled = Boolean(context.initialCycle);
  const section = createSectionController(meshes, bounds, runtime.render, onChange, runtime.scene);

  const applyAppearance = () => {
    for (const mesh of meshes) {
      mesh.visible = !isolated || isolatedParts.has(mesh.userData.partId);
      mesh.material = mesh.userData.partId === selectedId
        ? highlight
        : (focusSet.size > 0 && !focusSet.has(mesh.userData.partId))
          ? ghost
          : snapshot.appearance === 'cad'
            ? originals.get(mesh)!
            : inspection.get(mesh)!;
    }
    section.refresh();
  };

  const select = (id: string) => {
    selectedId = id;
    isolated = false;
    const part = catalogueById.get(id);
    snapshot.selectedId = id || undefined;
    snapshot.selectedLabel = part?.display_name;
    snapshot.selectedDescription = part?.function;
    snapshot.isolated = false;
    applyAppearance();
    onChange();
  };
  runtime.setPickTargets(meshes, (object) => select(object.userData.partId));

  root.updateMatrixWorld(true);
  const bind = groupMatrices(motionProfile.bind_angle_deg, motionProfile);
  const motionEntries: MotionEntry[] = meshes.map((mesh) => {
    const group = motionProfile.groups[mesh.userData.partId] as MotionEntry['group'];
    mesh.matrixAutoUpdate = false;
    return { mesh, group, localBind: bind[group].clone().invert().multiply(mesh.matrixWorld) };
  });
  const cycleVisuals = motionProfile.cycle_landmarks ? createCycleVisuals(runtime.scene, motionProfile.cycle_landmarks, runtime.camera) : undefined;
  cycleVisuals?.setVisible(cycleEnabled);

  const setAngle = (degrees: number) => {
    const angle = ((degrees % 720) + 720) % 720;
    snapshot.angle = angle;
    const transforms = groupMatrices(angle, motionProfile);
    const valves = motionProfile.valves ? valveMatrices(angle, motionProfile.valves) : undefined;
    const valveTransforms = valves?.matrices as Record<string, THREE.Matrix4> | undefined;
    for (const { mesh, group, localBind } of motionEntries) {
      const world = transforms[group].clone().multiply(localBind);
      const delta = valveTransforms?.[mesh.userData.partId];
      if (delta) world.premultiply(delta);
      const spring = motionProfile.valves?.spring_targets?.[mesh.userData.partId];
      if (spring && mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
        mesh.morphTargetInfluences[mesh.morphTargetDictionary[spring.target]] = (valves!.cycle as any)[`${spring.train}Lift`] / spring.maximum_lift_mm;
      }
      mesh.matrix.copy(mesh.parent!.matrixWorld).invert().multiply(world);
    }
    root.updateMatrixWorld(true);
    const pistonMillimetres = mechanismPose(angle, motionProfile.radius_m, motionProfile.rod_length_m).piston[0] * 1000;
    snapshot.motionNote = valves
      ? `${valves.cycle.stroke} · piston pin ${pistonMillimetres.toFixed(1)} mm from crank axis · intake lift ${valves.cycle.intakeLift.toFixed(1)} mm · exhaust lift ${valves.cycle.exhaustLift.toFixed(1)} mm.`
      : `Piston pin ${pistonMillimetres.toFixed(1)} mm from crank axis.`;
    if (cycleVisuals) snapshot.cycleNote = cycleVisuals.update(angle, pistonMillimetres).description;
    section.sync();
    runtime.render();
    onChange();
  };

  const setPlaying = (value: boolean) => {
    playing = value;
    snapshot.playing = value;
    runtime.setAnimationCallback(value ? (elapsed) => {
      if (!playing) return false;
      setAngle((snapshot.angle || 0) + elapsed * 30);
      return true;
    } : undefined);
    onChange();
  };

  setAngle(context.initialAngle ?? motionProfile.bind_angle_deg);

  // A lesson step can spotlight a group of parts: the rest are ghosted and the camera frames the group at the posed angle.
  const applyFocus = (ids: string[] = []) => {
    const unknown = ids.filter((id) => !catalogueById.has(id));
    if (unknown.length) throw Error(`Unknown component id in focusParts: ${unknown.join(', ')}.`);
    focusSet.clear();
    for (const id of ids) focusSet.add(id);
    selectedId = '';
    isolated = false;
    snapshot.selectedId = undefined;
    snapshot.selectedLabel = undefined;
    snapshot.selectedDescription = undefined;
    snapshot.isolated = false;
    applyAppearance();
    if (!focusSet.size) { runtime.fit(root); return; }
    const focusBox = new THREE.Box3();
    for (const mesh of meshes) if (focusSet.has(mesh.userData.partId)) focusBox.union(new THREE.Box3().setFromObject(mesh));
    const size = focusBox.getSize(new THREE.Vector3());
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
    proxy.position.copy(focusBox.getCenter(new THREE.Vector3()));
    runtime.fit(proxy);
    proxy.geometry.dispose();
  };
  if (focusSet.size) applyFocus([...focusSet]);

  const parts: ModelComponent[] = [...catalogueById.entries()].map(([id, part]) => ({
    id,
    label: part.display_name || id,
    description: part.function || '',
    group: componentGroup(id),
    source: part.function_source_summary,
    evidence: part.geometry_evidence_status,
  })).sort((left, right) => left.label.localeCompare(right.label));
  const groups: ModelGroup[] = [
    { id: '', label: 'All groups' },
    { id: 'structure', label: 'Cylinder structure' },
    { id: 'piston', label: 'Piston, rings and pin' },
    { id: 'crank', label: 'Crank and connecting rod' },
    { id: 'intake', label: 'Intake valve train' },
    { id: 'exhaust', label: 'Exhaust valve train' },
    { id: 'ignition', label: 'Spark plugs' },
  ];

  return {
    snapshot: () => ({ ...snapshot, ...section.snapshot() }),
    // Lesson step change on the already-loaded model: new pose, cycle cues and spotlight without reloading the GLB.
    update(view) {
      setPlaying(false);
      cycleEnabled = Boolean(view.initialCycle);
      snapshot.cycleEnabled = cycleEnabled;
      cycleVisuals?.setVisible(cycleEnabled);
      setAngle(view.initialAngle ?? motionProfile.bind_angle_deg);
      applyFocus(view.focusParts);
      onChange();
    },
    features: {
      components: {
        items: parts,
        groups,
        select,
        isolate() {
          if (!selectedId) return;
          isolatedParts.clear();
          isolatedParts.add(selectedId);
          isolated = true;
          snapshot.isolated = true;
          applyAppearance();
          const picked = meshes.find((mesh) => mesh.userData.partId === selectedId);
          if (picked) runtime.fit(picked);
          onChange();
        },
        isolateGroup(groupId) {
          const ids = groupComponentIds(parts, groupId);
          if (!groupId || groupId === 'all' || !ids.length) return;
          select('');
          focusSet.clear();
          isolatedParts.clear();
          for (const id of ids) isolatedParts.add(id);
          isolated = true;
          snapshot.isolated = true;
          snapshot.selectedLabel = groups.find(group => group.id === groupId)?.label;
          snapshot.selectedDescription = `${ids.length} components isolated. Motion and section controls remain available.`;
          applyAppearance();
          const box = new THREE.Box3();
          for (const mesh of meshes) if (mesh.visible) box.expandByObject(mesh);
          const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()));
          proxy.position.copy(box.getCenter(new THREE.Vector3()));
          runtime.fit(proxy);
          proxy.geometry.dispose();
          onChange();
        },
        showAll() {
          selectedId = '';
          isolated = false;
          focusSet.clear();
          snapshot.selectedId = undefined;
          snapshot.selectedLabel = undefined;
          snapshot.selectedDescription = undefined;
          snapshot.isolated = false;
          applyAppearance();
          runtime.fit(root);
          onChange();
        },
      },
      motion: { setAngle: (angle) => { setPlaying(false); setAngle(angle); }, setPlaying, reset: () => { setPlaying(false); setAngle(motionProfile.bind_angle_deg); } },
      cycleCues: {
        setEnabled(value) {
          cycleEnabled = value;
          snapshot.cycleEnabled = value;
          cycleVisuals?.setVisible(value);
          setAngle(snapshot.angle || 0);
        },
      },
      section: section.feature,
      appearance: {
        setMode(mode: AppearanceMode) { snapshot.appearance = mode; applyAppearance(); onChange(); },
      },
    },
    dispose() {
      playing = false;
      runtime.setAnimationCallback(undefined);
      runtime.setPickTargets([]);
      section.dispose();
      cycleVisuals?.dispose();
      runtime.scene.remove(root);
      for (const material of inspection.values()) material.dispose();
      highlight.dispose();
      ghost.dispose();
      disposeObject(root);
    },
  };
}
