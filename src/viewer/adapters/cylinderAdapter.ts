import * as THREE from 'three';
import type { ModelDefinition } from '../../data/modelRegistry';
import { createExplodedMotion, stopsOf } from '../core/saved-motions.mjs';
import { learnerPartFor, learnerSearchText, loadLearnerParts, type LearnerPart } from '../../data/learnerPartDetails';
import { cylinderPartGroup, groupComponentIds } from '../core/component-groups.mjs';
import { loadGltf } from '../core/assets';
import { createSectionController, disposeObject, frameObjects, partBoxes } from '../core/modelUtils';
import { createHiddenParts } from '../core/part-visibility.mjs';
import { mechanismPose } from '../engineering/kinematics.mjs';
import { valveMatrices } from '../engineering/valve-transforms.mjs';
import { createCycleVisuals } from '../engineering/cycle-visuals.mjs';
import { focusModeOrDefault, partLook, partRole, spotlightPalette } from '../core/focus-style.mjs';
import { effectiveFocusMode } from '../core/spotlight-fallback';
import { drawOverGhost } from '../core/ghost-order.mjs';
import { closeUpOnSpotlight } from '../core/spotlight-closeup';
import type { AdapterContext, AppearanceMode, FocusMode, ModelComponent, ModelGroup, ViewerSession, ViewerSnapshot } from '../types';

type MotionEntry = { mesh: THREE.Mesh; group: 'Piston' | 'ConnectingRod' | 'Crank' | 'Cylinder'; localBind: THREE.Matrix4 };

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

/** The four strokes over the crank's 720 degrees, as the cylinder's valve model counts them (the cycle starts at the intake stroke). */
const STROKES = ['Intake', 'Compression', 'Power', 'Exhaust'].map((label, index) => ({ label, start: index * 180, end: (index + 1) * 180 }));

export async function createCylinderSession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  const { runtime, signal, onChange, onProgress } = context;
  // The part card reads the learner part details (the part store, docs/part-store.md); failing to load them leaves the card with the catalogue's own name and function.
  const [catalogueResponse, motionResponse, loaded, savedResponse, learner] = await Promise.all([
    fetch(definition.componentCatalogueUrl!, { signal }),
    fetch(definition.motionProfileUrl!, { signal }),
    loadGltf(definition.sources || [], signal, onProgress),
    definition.savedMotionsUrl ? fetch(definition.savedMotionsUrl, { signal }) : undefined,
    definition.partDetailsUrl ? loadLearnerParts(definition.partDetailsUrl, definition.id, signal) : undefined,
  ]);
  if (!catalogueResponse.ok) throw Error('The cylinder component catalogue is unavailable.');
  if (!motionResponse.ok) throw Error('The cylinder motion profile is unavailable.');
  const catalogue = await catalogueResponse.json();
  const motionProfile = await motionResponse.json();
  if (savedResponse && !savedResponse.ok) throw Error('Saved cylinder motions are unavailable.');
  const savedProfile = savedResponse ? await savedResponse.json() : undefined;
  if (savedProfile && savedProfile.source_asset_sha256 !== motionProfile.asset_sha256) throw Error('Saved motions belong to a different cylinder revision.');
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
  const detailsById = new Map<string, LearnerPart>();
  for (const id of catalogueById.keys()) { const details = learnerPartFor(learner, id); if (details) detailsById.set(id, details); }
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const inspection = new Map<THREE.Mesh, THREE.Material>();
  for (const mesh of meshes) {
    originals.set(mesh, mesh.material);
    inspection.set(mesh, inspectionMaterial(mesh.userData.partId));
  }
  // The spotlight's colours depend on the theme, so applyAppearance sets them each time; these are only where they start.
  const colours = spotlightPalette(runtime.theme?.());
  const highlight = new THREE.MeshStandardMaterial({ color: colours.highlightColor, emissive: 0x063e38, emissiveIntensity: 0.7, metalness: 0.45, roughness: 0.3 });
  const ghost = new THREE.MeshStandardMaterial({ color: colours.ghostColor, transparent: true, opacity: colours.ghostOpacity, depthWrite: false });
  const pale = new THREE.MeshStandardMaterial({ color: colours.paleColor, metalness: 0, roughness: 0.85 });

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
  // Parts the learner has hidden to look beneath them: out of sight whatever the spotlight or an isolation would show.
  const hidden = createHiddenParts();
  const focusSet = new Set(context.focusParts || []);
  let focusMode: FocusMode = focusModeOrDefault(context.focusMode);
  let playing = false;
  let cycleEnabled = Boolean(context.initialCycle);
  // A cut through a spotlit part shows it, which can change the style the spotlight is drawn in, so the spotlight is repainted when it does.
  let drawnMode: FocusMode | undefined;
  const section = createSectionController(meshes, bounds, runtime.render, onChange, runtime.scene, () => { if (drawnMode && spotlightMode() !== drawnMode) applyAppearance(); });
  section.startStep(context.sectionPlane);

  // Highlight would hide a spotlit part that sits inside another, so it is drawn as X-ray for as long as that is so.
  const spotlightMode = () => focusSet.size > 0
    ? effectiveFocusMode(focusMode, meshes.filter((mesh) => focusSet.has(mesh.userData.partId)), meshes.filter((mesh) => !focusSet.has(mesh.userData.partId) && (!isolated || isolatedParts.has(mesh.userData.partId)) && !hidden.has(mesh.userData.partId)), section.cut())
    : focusMode;
  const applyAppearance = () => {
    const palette = spotlightPalette(runtime.theme?.());
    highlight.color.set(palette.highlightColor);
    ghost.color.set(palette.ghostColor); ghost.opacity = palette.ghostOpacity;
    pale.color.set(palette.paleColor);
    const spotlight = focusSet.size > 0;
    const mode = drawnMode = spotlightMode();
    snapshot.hiddenIds = hidden.ids();
    snapshot.focusActive = spotlight;
    snapshot.focusMode = focusMode;
    snapshot.focusFallback = mode !== focusMode;
    for (const mesh of meshes) {
      const id = mesh.userData.partId;
      const { visible, look } = partLook(mode, partRole(spotlight, focusSet.has(id)));
      mesh.visible = visible && (!isolated || isolatedParts.has(id)) && !hidden.has(id);
      mesh.material = id === selectedId || look === 'highlight'
        ? highlight
        : look === 'ghost'
          ? ghost
          : look === 'pale'
            ? pale
            : snapshot.appearance === 'cad'
              ? originals.get(mesh)!
              : inspection.get(mesh)!;
      // While the rest is ghosted, the solid parts are drawn after the ghost so its layers never cover them (core/ghost-order.mjs).
      drawOverGhost(mesh, spotlight && mode === 'xray' && mesh.material !== ghost);
    }
    section.refresh();
  };

  // The page changing theme repaints the spotlight in the new theme's colours (the runtime repaints the stage and renders).
  const stopWatchingTheme = runtime.onThemeChange?.(() => { applyAppearance(); onChange(); });

  const select = (id: string) => {
    selectedId = id;
    isolated = false;
    const part = catalogueById.get(id);
    const details = detailsById.get(id);
    snapshot.selectedId = id || undefined;
    // The Parts list and its summary keep the catalogue's names (lessons and checks refer to them); only the part card speaks from the details.
    snapshot.selectedLabel = part?.display_name;
    snapshot.selectedDescription = part?.function;
    snapshot.selectedDetails = details;
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
  // The saved motions: the exploded overview, the same played backwards as reassembly, and any further motions the file lists (the
  // removal order from the overhaul manual). Each has its own stages, note and length.
  type SavedMotion = { label: string; profile: { stages: { label: string; note: string; progress: number }[]; scope: string; duration_seconds?: number }; motion: ReturnType<typeof createExplodedMotion>; reverse: boolean };
  const savedMotions = new Map<string, SavedMotion>();
  if (savedProfile) {
    const exploded = createExplodedMotion(meshes, savedProfile);
    savedMotions.set('exploded', { label: 'Exploded overview', profile: savedProfile, motion: exploded, reverse: false });
    savedMotions.set('reassembly', { label: 'Reassembly overview', profile: savedProfile, motion: exploded, reverse: true });
    for (const extra of savedProfile.motions ?? []) savedMotions.set(extra.id, { label: extra.label, profile: extra, motion: createExplodedMotion(meshes, extra), reverse: false });
  }
  const stagesOf = (entry: SavedMotion) => entry.reverse ? [...entry.profile.stages].reverse().map(stage => ({ ...stage, progress: 100 - stage.progress })) : entry.profile.stages;
  let savedMotionId = 'operating';
  let motionProgress = 0;
  // Playback: a speed for everything, and a loop choice for each motion (the crank goes round and round; a saved motion stops at its end).
  let speed = 1;
  const loops = new Map<string, boolean>();
  const loopOf = () => loops.get(savedMotionId) ?? savedMotionId === 'operating';
  const syncPlayback = () => { snapshot.motionSpeed = speed; snapshot.motionLoop = loopOf(); };
  syncPlayback();
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
    if (value && savedMotionId !== 'operating' && motionProgress >= 100) applyMotionProgress(0);
    // A crank that stopped at the end of its turn (not looping) starts again from the top.
    if (value && savedMotionId === 'operating' && !loopOf() && (snapshot.angle || 0) >= 719) setAngle(0);
    runtime.setAnimationCallback(value ? (elapsed) => {
      if (!playing) return false;
      if (savedMotionId === 'operating') {
        const next = (snapshot.angle || 0) + elapsed * 30 * speed;
        if (!loopOf() && next >= 720) { setAngle(719.99); playing = false; snapshot.playing = false; onChange(); return false; }
        setAngle(next);
      } else {
        const next = motionProgress + elapsed * 100 * speed / (savedMotions.get(savedMotionId)?.profile.duration_seconds ?? savedProfile.duration_seconds);
        applyMotionProgress(loopOf() && next >= 100 ? next % 100 : Math.min(100, next));
        if (motionProgress >= 100) { playing = false; snapshot.playing = false; onChange(); return false; }
      }
      return true;
    } : undefined);
    onChange();
  };

  const applyMotionProgress = (value: number) => {
    const current = savedMotions.get(savedMotionId);
    if (!current) return;
    motionProgress = Math.max(0, Math.min(100, value));
    snapshot.motionProgress = motionProgress;
    current.motion.apply(motionProgress, current.reverse);
    root.updateMatrixWorld(true);
    const stage = current.motion.stage(motionProgress, current.reverse);
    snapshot.motionStage = stage.label;
    snapshot.motionNote = `${stage.note} ${current.profile.scope}`;
    section.sync(); runtime.render(); onChange();
  };
  const selectMotion = (id: string) => {
    if (id !== 'operating' && !savedMotions.has(id)) throw Error(`Unknown cylinder motion: ${id}`);
    setPlaying(false); savedMotionId = id; snapshot.savedMotionId = id; syncPlayback();
    cycleVisuals?.setVisible(id === 'operating' && cycleEnabled);
    if (id === 'operating') { snapshot.motionStage = undefined; setAngle(snapshot.angle || 0); }
    // Fit the camera to the motion at its widest (the end of a take-apart, the start of a reassembly), then show its start.
    else { applyMotionProgress(savedMotions.get(id)!.reverse ? 0 : 100); }
    section.updateBounds(new THREE.Box3().setFromObject(root));
    runtime.fit(root);
    if (id !== 'operating' && !savedMotions.get(id)!.reverse) applyMotionProgress(0);
    onChange();
  };
  snapshot.savedMotionId = 'operating';
  // The pose the model opens at: a lesson step's own (a crank angle, or a saved motion at some progress), else the default. Reset returns here.
  let start = { angle: context.initialAngle ?? motionProfile.bind_angle_deg, motionId: context.savedMotionId || 'operating', progress: context.motionProgress ?? 0 };
  setAngle(start.angle);

  // A lesson step can spotlight a group of parts, drawn as its focus mode says, and the camera frames the group at the posed angle.
  const applyFocus = (ids: string[] = [], mode: FocusMode = focusMode) => {
    const unknown = ids.filter((id) => !catalogueById.has(id));
    if (unknown.length) throw Error(`Unknown component id in focusParts: ${unknown.join(', ')}.`);
    focusSet.clear();
    for (const id of ids) focusSet.add(id);
    focusMode = mode;
    selectedId = '';
    isolated = false;
    snapshot.selectedId = undefined;
    snapshot.selectedLabel = undefined;
    snapshot.selectedDescription = undefined;
    snapshot.selectedDetails = undefined;
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
    group: cylinderPartGroup(id),
    source: part.function_source_summary,
    evidence: part.geometry_evidence_status,
    // The other names a learner knows a part by (tappet, rocker arm) find it in the Parts search.
    searchText: detailsById.has(id) ? learnerSearchText(detailsById.get(id)!) : undefined,
    details: detailsById.get(id),
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

  if (context.savedMotionId && context.savedMotionId !== 'operating') { selectMotion(context.savedMotionId); applyMotionProgress(context.motionProgress ?? 0); applyFocus(context.focusParts); }

  return {
    snapshot: () => ({ ...snapshot, ...section.snapshot() }),
    // Lesson step change on the already-loaded model: new pose, cycle cues and spotlight without reloading the GLB.
    update(view) {
      setPlaying(false);
      hidden.clear();
      cycleEnabled = Boolean(view.initialCycle);
      snapshot.cycleEnabled = cycleEnabled;
      cycleVisuals?.setVisible(cycleEnabled);
      start = { angle: view.initialAngle ?? motionProfile.bind_angle_deg, motionId: view.savedMotionId || 'operating', progress: view.motionProgress ?? 0 };
      setAngle(start.angle);
      selectMotion(view.savedMotionId || 'operating');
      if (view.savedMotionId && view.savedMotionId !== 'operating') applyMotionProgress(view.motionProgress ?? 0);
      applyFocus(view.focusParts, focusModeOrDefault(view.focusMode));
      section.startStep(view.sectionPlane);
      onChange();
    },
    features: {
      focus: {
        setMode(mode) {
          focusMode = focusModeOrDefault(mode);
          applyAppearance();
          onChange();
        },
        set(ids, mode, options) {
          const unknown = ids.filter((id) => !catalogueById.has(id));
          if (unknown.length) throw Error(`Unknown component id in the spotlight: ${unknown.join(', ')}.`);
          focusSet.clear();
          for (const id of ids) focusSet.add(id);
          focusMode = focusModeOrDefault(mode);
          isolated = false;
          snapshot.isolated = false;
          applyAppearance();
          // On its own, a small part would be a speck in the middle of the screen.
          const box = new THREE.Box3();
          if (focusMode === 'isolate') for (const mesh of meshes) if (focusSet.has(mesh.userData.partId)) box.expandByObject(mesh);
          if (!box.isEmpty()) {
            const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()));
            proxy.position.copy(box.getCenter(new THREE.Vector3()));
            runtime.fit(proxy);
            proxy.geometry.dispose();
          } else if (options?.closeUp) closeUpOnSpotlight(runtime, meshes.filter((mesh) => focusSet.has(mesh.userData.partId)), root);
          onChange();
        },
      },
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
          hidden.clear();
          focusSet.clear();
          snapshot.selectedId = undefined;
          snapshot.selectedLabel = undefined;
          snapshot.selectedDescription = undefined;
          snapshot.selectedDetails = undefined;
          snapshot.isolated = false;
          applyAppearance();
          runtime.fit(root);
          onChange();
        },
        hide(ids) {
          if (!hidden.hide(ids.filter((id) => catalogueById.has(id))).length) return;
          if (hidden.has(selectedId)) select(''); else { applyAppearance(); onChange(); }
        },
        undoHide() { if (hidden.undo().length) { applyAppearance(); onChange(); } },
        showHidden() { if (hidden.clear()) { applyAppearance(); onChange(); } },
        boxes: () => partBoxes(meshes.map((mesh): [string, THREE.Object3D] => [mesh.userData.partId, mesh])),
        frame: (ids) => frameObjects(runtime, meshes.filter((mesh) => ids.includes(mesh.userData.partId)), root),
      },
      savedMotions: savedProfile ? {
        items: [{ id: 'operating', label: 'Operating cycle', stages: [] }, ...[...savedMotions].map(([id, entry]) => ({ id, label: entry.label, stages: stagesOf(entry) }))],
        select: selectMotion,
        setProgress(value) { setPlaying(false); applyMotionProgress(value); },
        step(direction) {
          const current = savedMotions.get(savedMotionId);
          const stops = current ? [...new Set([...stopsOf(stagesOf(current)), 100])].sort((a, b) => a - b) : [0, 100];
          const target = direction > 0 ? stops.find(value => value > motionProgress + .01) ?? 100 : [...stops].reverse().find(value => value < motionProgress - .01) ?? 0;
          setPlaying(false); applyMotionProgress(target);
        },
      } : undefined,
      motion: {
        setAngle: (angle) => { setPlaying(false); if (savedMotionId !== 'operating') selectMotion('operating'); setAngle(angle); },
        setPlaying,
        reset: () => { setPlaying(false); if (savedMotionId === 'operating') setAngle(start.angle); else applyMotionProgress(savedMotionId === start.motionId ? start.progress : 0); },
        setSpeed: (value) => { speed = value; syncPlayback(); onChange(); },
        setLoop: (value) => { loops.set(savedMotionId, value); syncPlayback(); onChange(); },
        strokes: STROKES,
      },
      cycleCues: {
        setEnabled(value) {
          cycleEnabled = value;
          snapshot.cycleEnabled = value;
          cycleVisuals?.setVisible(value && savedMotionId === 'operating');
          if (savedMotionId === 'operating') setAngle(snapshot.angle || 0);
        },
      },
      section: section.feature,
      appearance: {
        setMode(mode: AppearanceMode) { snapshot.appearance = mode; applyAppearance(); onChange(); },
      },
    },
    dispose() {
      playing = false;
      stopWatchingTheme?.();
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
