import * as THREE from 'three';
import type { ModelDefinition } from '../../data/modelRegistry';
import type { AdapterContext, FocusMode, ViewerSession, ViewerSnapshot } from '../types';
import { loadGltf } from '../core/assets';
import { learnerPartFor, learnerSearchText, loadLearnerParts, type LearnerPart } from '../../data/learnerPartDetails';
import { cloneMaterials, createSectionController, disposeObject, meshMaterials } from '../core/modelUtils';
import { groupComponentIds } from '../core/component-groups.mjs';
import { focusModeOrDefault, partLook, partRole, spotlightPalette } from '../core/focus-style.mjs';
import { effectiveFocusMode } from '../core/spotlight-fallback';
import { OVER_GHOST_ORDER } from '../core/ghost-order.mjs';
import { closeUpOnSpotlight } from '../core/spotlight-closeup';
import {
  crankAngleForMotion,
  createProceduralStudySampler,
  indexStudyParts,
  resolveMotionDisplay,
} from '../core/animated-study-motion.mjs';
import { checkStudyContract } from '../core/motion-compatibility.mjs';

export async function createAnimatedStudySession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  const { runtime, signal, onChange, onProgress } = context;
  // A model with learner part details (the GTSIO-520-H whole engine) names and explains its parts from them; failing to load them leaves the contract's own labels.
  const [response, loaded, learner] = await Promise.all([
    fetch(definition.contractUrl!, { signal }),
    loadGltf(definition.sources || [], signal, onProgress),
    definition.partDetailsUrl ? loadLearnerParts(definition.partDetailsUrl, definition.id, signal) : undefined,
  ]);
  if (!response.ok) throw Error('The mechanism study contract is unavailable.');
  const contract = await response.json();
  checkStudyContract(contract);
  const digest =Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', loaded.bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== contract.asset_sha256) throw Error('The mechanism asset does not match its contract.');
  signal.throwIfAborted();
  const root = loaded.gltf.scene; cloneMaterials(root);
  const { meshes, partsById } = indexStudyParts(root) as { meshes: THREE.Mesh[]; partsById: Map<string, THREE.Mesh> };
  const paths: any[] = contract.powerPaths || [];
  const contractPartsById = new Map<string, any>((contract.parts || []).map((part: any) => [part.id, part]));
  const detailsById = new Map<string, LearnerPart>();
  for (const part of contract.parts) { const details = learnerPartFor(learner, part.id); if (details) detailsById.set(part.id, details); }
  const components = contract.parts.map((part: any) => ({ id: part.id, label: detailsById.get(part.id)?.label ?? part.label, group: part.group, groups: [...paths.filter(path => path.parts.includes(part.id)).map(path => `path:${path.id}`), ...(part.groups || [])], description: detailsById.get(part.id)?.function.text ?? part.description, searchText: detailsById.has(part.id) ? learnerSearchText(detailsById.get(part.id)!) : undefined, source: part.evidence || contract.reference, evidence: part.shape_status || 'Illustrative dimensions' }));
  const componentsById = new Map<string, any>(components.map((part: any) => [part.id, part]));
  if (meshes.length !== components.length || meshes.some(mesh => !componentsById.has(mesh.userData.partId))) throw Error('Mechanism components do not match the contract.');
  const clips = new Map(loaded.gltf.animations.map(clip => [clip.name, clip]));
  // Per-model orientation: a contract's optional `display` block turns the model and sets the camera direction used to frame it.
  // Models without it keep the file's own orientation and the default framing.
  const display = contract.display || {};
  const fitDirection = Array.isArray(display.fit_direction) && display.fit_direction.length === 3 ? new THREE.Vector3(...(display.fit_direction as [number, number, number])) : undefined;
  if (Number.isFinite(display.rotation_x_deg)) root.rotation.x = THREE.MathUtils.degToRad(display.rotation_x_deg);
  runtime.scene.add(root); root.updateMatrixWorld(true); runtime.fit(root, fitDirection);
  const procedural = createProceduralStudySampler(contract, partsById, root);
  for (const motion of contract.motions) {
    if (!clips.has(motion.id) && !procedural.supports(motion)) throw Error(`Saved motion is missing: ${motion.id}`);
  }
  const bounds = new THREE.Box3().setFromObject(root);
  // A cut through a spotlit part shows it, which can change the style the spotlight is drawn in, so the spotlight is repainted when it does.
  let drawnMode: FocusMode | undefined;
  const section = createSectionController(meshes, bounds, runtime.render, onChange, runtime.scene, () => { if (drawnMode && spotlightMode() !== drawnMode) applyAppearance(); });
  const mixer = new THREE.AnimationMixer(root);
  const snapshot: ViewerSnapshot = { status: 'Animated mechanism study ready', appearance: 'inspection', playing: false, motionProgress: 0, motionNote: contract.scope };
  let active: any, action: THREE.AnimationAction | undefined, progress = 0, playing = false;
  // Playback: a speed for everything, and a loop choice + view mode ('core' vs 'assembled') for each motion.
  let speed = 1;
  const loops = new Map<string, boolean>();
  const motionViewModes = new Map<string, 'core' | 'assembled'>();
  const loopOf = () => loops.get(active.id) ?? Boolean(active.loop);
  const durationOf = () => clips.get(active?.id)?.duration ?? Number(active?.duration || 12);
  const syncPlayback = () => { snapshot.motionSpeed = speed; snapshot.motionLoop = loopOf(); };
  let isolation: Set<string> | undefined;
  const focus = new Set<string>();
  let focusMode: FocusMode = focusModeOrDefault(context.focusMode);
  let powerPath: any;
  // Helpers follow each animated shaft, including the exploded pose. They are not pick targets.
  const arrows = new THREE.Group(); arrows.name = 'Output rotation arrows'; runtime.scene.add(arrows);
  const arrowBindings: { helper: THREE.Group; mesh: THREE.Mesh; offset: THREE.Vector3 }[] = [];
  for (const output of contract.rotationOutputs || []) {
    const mesh = partsById.get(output.id);
    if (!mesh) continue;
    const helper = new THREE.Group(); helper.name = `${output.id} rotation direction`;
    const axis = new THREE.Vector3(...(output.axis || [0, 1, 0]) as [number, number, number]).normalize();
    helper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const offset = axis.clone().multiplyScalar(output.markerOffsetM ?? (output.id === 'StarterWorm' ? .046 : .027));
    const color = 0x62f4cf, radius = .014;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, .0012, 6, 28, Math.PI * 1.65), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false }));
    arc.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.0035, .008, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false }));
    arc.renderOrder = 10000; tip.renderOrder = 10001;
    const cw = output.direction.startsWith('CW'); tip.position.set(radius, 0, 0); tip.rotation.x = cw ? Math.PI / 2 : -Math.PI / 2;
    helper.add(arc, tip); helper.userData.partId = output.id; arrows.add(helper); arrowBindings.push({ helper, mesh, offset });
  }
  const route = new THREE.Group(); route.name = 'Selected power path'; runtime.scene.add(route);
  const syncHelpers = () => {
    for (const { helper, mesh, offset } of arrowBindings) {
      helper.visible = !!powerPath?.outputs.includes(mesh.userData.partId) && mesh.visible;
      // World positions follow Blender's metre and glTF Y-up conversion; direction arrows remain in the pad frame.
      helper.position.copy(mesh.getWorldPosition(new THREE.Vector3())).add(offset);
    }
    if (powerPath) {
      const points = (powerPath.edges || []).flatMap(([from, to]: string[]) => {
        const a = partsById.get(from), b = partsById.get(to);
        // CAD solids can have an origin at (0,0,0) while their vertices sit at
        // an accessory pad. Anchor paths to visible geometry, not that origin.
        return a?.visible && b?.visible ? [new THREE.Box3().setFromObject(a).getCenter(new THREE.Vector3()), new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3())] : [];
      });
      if (points.length > 1) {
        let line = route.children[0] as THREE.LineSegments | undefined;
        if (!line || line.geometry.getAttribute('position').count !== points.length) {
          for (const object of [...route.children]) { route.remove(object); disposeObject(object); }
          line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: 0x62f4cf, dashSize: .006, gapSize: .004, transparent: true, opacity: .65, depthTest: false }));
          line.frustumCulled = false; route.add(line);
        } else {
          const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
          points.forEach((point: THREE.Vector3, index: number) => positions.setXYZ(index, point.x, point.y, point.z)); positions.needsUpdate = true;
        }
        line.computeLineDistances();
      } else for (const object of [...route.children]) { route.remove(object); disposeObject(object); }
    } else for (const object of [...route.children]) { route.remove(object); disposeObject(object); }
  };
  const materialColors = new Map<THREE.Material, THREE.Color>();
  for (const mesh of meshes) for (const material of meshMaterials(mesh) as THREE.MeshStandardMaterial[]) materialColors.set(material, material.color.clone());
  const motionVisibility = (display: ReturnType<typeof resolveMotionDisplay>) => (id: string) => !display.visibleSet || display.visibleSet.has(id) || focus.has(id) || Boolean(isolation?.has(id));
  // Highlight would hide a spotlit part that sits inside another, so it is drawn as X-ray for as long as that is so.
  const spotlightMode = () => {
    if (powerPath || !focus.size) return focusMode;
    const motionVisible = motionVisibility(resolveMotionDisplay(active, contract.parts, motionViewModes.get(active?.id) || 'default'));
    return effectiveFocusMode(focusMode, meshes.filter((mesh) => focus.has(mesh.userData.partId)), meshes.filter((mesh) => !focus.has(mesh.userData.partId) && (!isolation || isolation.has(mesh.userData.partId)) && motionVisible(mesh.userData.partId)), section.cut());
  };
  const applyAppearance = () => {
    const pathColors: Record<string, string> = { housing: '#536878', core: '#84929e', fuel: '#be7b12', 'magneto-left': '#148365', 'magneto-right': '#148365', 'oil-tach': '#1b60bc', starter: '#963f7c', alternator: '#a58b21', vacuum: '#7752a7', governor: '#187f88' };
    // A selected power path ghosts every part outside it; otherwise a lesson step's spotlight is drawn as its focus mode says.
    const palette = spotlightPalette(runtime.theme?.());
    const spotlight = !powerPath && focus.size > 0;
    const motionDisplay = resolveMotionDisplay(active, contract.parts, motionViewModes.get(active?.id) || 'default');
    snapshot.motionViewMode = motionDisplay.viewMode as 'core' | 'assembled';
    snapshot.motionAllowAssembled = motionDisplay.allowAssembled;
    const motionVisible = motionVisibility(motionDisplay);
    const mode = drawnMode = spotlightMode();
    snapshot.focusActive = spotlight;
    snapshot.focusMode = focusMode;
    snapshot.focusFallback = mode !== focusMode;
    const looks = meshes.map((mesh) => {
      const id = mesh.userData.partId;
      const spot = partLook(mode, partRole(spotlight, focus.has(id)));
      mesh.visible = spot.visible && (!isolation || isolation.has(id)) && motionVisible(id);
      const motionGhost = !powerPath && !spotlight && !isolation && motionDisplay.ghostSet.has(id);
      return powerPath && !powerPath.parts.includes(id) ? 'ghost' : motionGhost ? 'ghost' : spot.look;
    });
    // While some parts are ghosted, the solid ones are drawn after the ghost so its layers never cover them (core/ghost-order.mjs).
    const ghosting = meshes.some((mesh, index) => mesh.visible && looks[index] === 'ghost');
    meshes.forEach((mesh, index) => {
      const id = mesh.userData.partId;
      const look = looks[index];
      const overGhost = ghosting && look !== 'ghost';
      mesh.renderOrder = overGhost ? OVER_GHOST_ORDER : 0;
      const part = contractPartsById.get(id);
      for (const material of meshMaterials(mesh) as THREE.MeshStandardMaterial[]) {
        const ghost = look === 'ghost';
        material.opacity = ghost ? palette.ghostOpacity : 1; material.transparent = ghost || overGhost; material.depthWrite = !ghost;
        material.color.copy(materialColors.get(material)!);
        if (paths.length && snapshot.appearance === 'inspection') material.color.set(part?.role === 'teaching-fixture' ? '#46515a' : pathColors[part?.group] || '#84929e');
        if (paths.length && snapshot.appearance === 'inspection' && /Spring|Plate|Plunger/.test(id)) material.color.set(0x379e9b);
        if (ghost) material.color.set(palette.ghostColor);
        else if (look === 'pale') material.color.set(palette.paleColor);
        else if (look === 'highlight') material.color.set(palette.highlightColor);
        material.emissive.set(id === snapshot.selectedId || look === 'highlight' ? palette.highlightEmissive : powerPath?.parts.includes(id) ? 0x174638 : 0); material.emissiveIntensity = .6;
        material.needsUpdate = true;
      }
    });
    const separate = (contract.remoteDisplays || []).filter((display: any) =>
      components.some((part: any) => part.group === display.group && partsById.get(part.id)?.visible));
    snapshot.assemblyNotice = separate.length ? `${separate.map((display: any) => display.label).join(' · ')}: separate relocated displays. Engine connections omitted.` : undefined;
    section.refresh();
    syncHelpers();
  };
  // The page changing theme repaints the spotlight in the new theme's colours (the runtime repaints the stage and renders).
  const stopWatchingTheme = runtime.onThemeChange?.(() => { applyAppearance(); onChange(); });
  const applyPose = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    const clip = clips.get(active.id);
    if (clip && action) {
      action.time = clip.duration * clamped / 100;
      mixer.update(0);
      root.updateMatrixWorld(true);
    } else {
      procedural.apply(active, clamped);
    }
  };
  const sample = (value: number) => {
    progress = Math.max(0, Math.min(100, value)); snapshot.motionProgress = progress;
    snapshot.angle = crankAngleForMotion(active, progress);
    applyPose(progress);
    section.sync(); syncHelpers();
    const stage = [...active.stages].reverse().find((stage: any) => progress >= stage.progress);
    snapshot.motionStage = stage?.label || active.label;
    snapshot.motionNote = `${stage?.note || ''} ${contract.scope}`;
    runtime.render(); onChange();
  };
  const setPlaying = (value: boolean) => {
    playing = value; snapshot.playing = value;
    if (value && progress >= 100) sample(0);
    runtime.setAnimationCallback(value ? elapsed => {
      const next = progress + elapsed * 100 * speed / Math.max(durationOf(), .1);
      if (next >= 100 && !loopOf()) { sample(100); playing = false; snapshot.playing = false; onChange(); return false; }
      sample(loopOf() ? next % 100 : next); return playing;
    } : undefined); onChange();
  };
  const selectMotion = (id: string) => {
    const motion = contract.motions.find((motion: any) => motion.id === id);
    if (!motion) throw Error(`Unknown saved motion: ${id}`);
    setPlaying(false); mixer.stopAllAction(); active = motion;
    const clip = clips.get(id);
    if (clip) {
      action = mixer.clipAction(clip); action.reset().setLoop(THREE.LoopOnce, 1).play(); action.clampWhenFinished = true; action.paused = true;
    } else {
      action = undefined;
      procedural.restoreRest();
    }
    snapshot.savedMotionId = id; syncPlayback();
    applyAppearance();
    // Use the union of both assembly extremes for cuts and framing in either direction.
    sample(0); const motionBounds = new THREE.Box3().setFromObject(root);
    sample(100); motionBounds.union(new THREE.Box3().setFromObject(root)); section.updateBounds(motionBounds);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...motionBounds.getSize(new THREE.Vector3()).toArray())); proxy.position.copy(motionBounds.getCenter(new THREE.Vector3())); runtime.fit(proxy, fitDirection); proxy.geometry.dispose(); sample(0);
  };
  const fitVisible = () => {
    const box = new THREE.Box3(); for (const mesh of meshes) if (mesh.visible) box.expandByObject(mesh);
    if (box.isEmpty()) return;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray())); proxy.position.copy(box.getCenter(new THREE.Vector3())); runtime.fit(proxy, fitDirection); proxy.geometry.dispose();
  };
  const select = (id: string) => {
    const part = componentsById.get(id);
    snapshot.selectedId = part?.id; snapshot.selectedLabel = part?.label; snapshot.selectedDescription = part?.description; snapshot.selectedDetails = part ? detailsById.get(part.id) : undefined;
    applyAppearance(); onChange();
  };
  const showAll = () => { isolation = undefined; focus.clear(); powerPath = undefined; snapshot.powerPathId = ''; snapshot.powerPathNote = ''; snapshot.isolated = false; select(''); fitVisible(); };
  runtime.setPickTargets(meshes, object => select(object.userData.partId));
  // The pose the study opens at (a lesson step's own motion and progress, else the first motion at 0%). Reset returns here.
  let start = { motionId: '', progress: 0 };
  const update = (view: any) => {
    start = { motionId: view.savedMotionId || contract.motions[0].id, progress: view.motionProgress || 0 };
    if (view.motionViewMode === 'core' || view.motionViewMode === 'assembled') {
      motionViewModes.set(start.motionId, view.motionViewMode);
    }
    powerPath = undefined; snapshot.powerPathId = ''; snapshot.powerPathNote = '';
    focus.clear(); for (const id of view.focusParts || []) focus.add(id);
    focusMode = focusModeOrDefault(view.focusMode);
    isolation = undefined; snapshot.isolated = false;
    selectMotion(start.motionId); sample(start.progress); applyAppearance();
    section.startStep(view.sectionPlane);
  };
  update(context);
  return {
    snapshot: () => ({ ...snapshot, ...section.snapshot() }), update,
    features: {
      focus: {
        setMode(mode) { focusMode = focusModeOrDefault(mode); applyAppearance(); onChange(); },
        set(ids, mode, options) {
          const unknown = ids.filter(id => !componentsById.has(id));
          if (unknown.length) throw Error(`Unknown component id in the spotlight: ${unknown.join(', ')}.`);
          focus.clear(); for (const id of ids) focus.add(id);
          focusMode = focusModeOrDefault(mode);
          isolation = undefined; snapshot.isolated = false;
          applyAppearance();
          // On its own, a small part would be a speck in the middle of the screen.
          if (focusMode === 'isolate' && ids.length) fitVisible();
          else if (options?.closeUp && ids.length) closeUpOnSpotlight(runtime, meshes.filter((mesh) => focus.has(mesh.userData.partId)), root);
          onChange();
        },
      },
      ...(paths.length ? { powerPaths: { items: paths.map(path => ({ id: path.id, label: path.label })), select(id: string) {
        powerPath = paths.find(path => path.id === id); snapshot.powerPathId = powerPath?.id || '';
        snapshot.powerPathNote = powerPath ? `${powerPath.note} Output direction: ${powerPath.direction}. ${powerPath.ratio === null ? 'Speed ratio unverified.' : `Drive / crank speed = ${powerPath.ratio}:1; at 1000 crank RPM: ${powerPath.ratio * 1000} drive RPM (${powerPath.id === 'starter' ? 'cranking only' : 'speed example'}).`} ${contract.viewpoint} Dashed lines are a conceptual path, not physical shaft geometry.` : '';
        applyAppearance(); onChange();
      }, isolate() { if (!powerPath) return; isolation = new Set(powerPath.parts); snapshot.isolated = true; applyAppearance(); fitVisible(); onChange(); } } } : {}),
      components: { items: components, groups: [{ id: '', label: 'All groups' }, ...(contract.groups ? contract.groups.map((group: any) => ({ id: group.id, label: `${group.depth ? '– ' : ''}${group.label}` })) : [...new Set<string>(components.map((part: any) => part.group))].map(id => ({ id, label: id.replaceAll('-', ' ') }))), ...paths.map(path => ({ id: `path:${path.id}`, label: `Complete path: ${path.label}` }))], select,
        isolate() { if (!snapshot.selectedId) return; isolation = new Set([snapshot.selectedId]); snapshot.isolated = true; applyAppearance(); fitVisible(); },
        isolateGroup(id) { if (!id) return; const ids = groupComponentIds(components, id); if (!ids.length) return; powerPath = undefined; snapshot.powerPathId = ''; snapshot.powerPathNote = ''; isolation = new Set(ids); snapshot.isolated = true; select(''); fitVisible(); }, showAll },
      savedMotions: {
        items: contract.motions,
        select: selectMotion,
        setProgress(value) { setPlaying(false); sample(value); },
        step(direction) {
          const stops = active.stages.map((stage: any) => stage.progress).sort((a: number, b: number) => a - b);
          setPlaying(false); sample(direction > 0 ? stops.find((value: number) => value > progress + .01) ?? 100 : [...stops].reverse().find((value: number) => value < progress - .01) ?? 0);
        },
        setViewMode(mode: 'core' | 'assembled') {
          if (mode !== 'core' && mode !== 'assembled') return;
          motionViewModes.set(active.id, mode);
          applyAppearance();
          runtime.render();
          onChange();
        },
      },
      motion: {
        setAngle: sample, setPlaying, reset() { setPlaying(false); sample(active.id === start.motionId ? start.progress : 0); },
        setSpeed(value) { speed = value; syncPlayback(); onChange(); },
        setLoop(value) { loops.set(active.id, value); syncPlayback(); onChange(); },
      }, section: section.feature,
      appearance: { setMode(mode) { snapshot.appearance = mode; applyAppearance(); } },
    },
    dispose() { setPlaying(false); stopWatchingTheme?.(); runtime.setPickTargets([]); mixer.stopAllAction(); mixer.uncacheRoot(root); section.dispose(); runtime.scene.remove(root, arrows, route); disposeObject(root); disposeObject(arrows); disposeObject(route); },
  };
}

