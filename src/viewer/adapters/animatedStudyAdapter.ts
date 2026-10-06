import * as THREE from 'three';
import type { ModelDefinition } from '../../data/modelRegistry';
import type { AdapterContext, FocusMode, ViewerSession, ViewerSnapshot } from '../types';
import { loadGltf } from '../core/assets';
import { cloneMaterials, createSectionController, disposeObject, meshMaterials } from '../core/modelUtils';
import { groupComponentIds } from '../core/component-groups.mjs';
import { HIGHLIGHT_COLOR, HIGHLIGHT_EMISSIVE, PALE_COLOR, XRAY_COLOR, XRAY_OPACITY, focusModeOrDefault, partLook, partRole } from '../core/focus-style.mjs';

export async function createAnimatedStudySession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  const { runtime, signal, onChange, onProgress } = context;
  const [response, loaded] = await Promise.all([fetch(definition.contractUrl!, { signal }), loadGltf(definition.sources || [], signal, onProgress)]);
  if (!response.ok) throw Error('The mechanism study contract is unavailable.');
  const contract = await response.json();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', loaded.bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== contract.asset_sha256) throw Error('The mechanism asset does not match its contract.');
  signal.throwIfAborted();
  const root = loaded.gltf.scene; cloneMaterials(root);
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh) { mesh.userData.partId = mesh.userData.cad_part_id; meshes.push(mesh); } });
  const paths: any[] = contract.powerPaths || [];
  const components = contract.parts.map((part: any) => ({ id: part.id, label: part.label, group: part.group, groups: [...paths.filter(path => path.parts.includes(part.id)).map(path => `path:${path.id}`), ...(part.groups || [])], description: part.description, source: part.evidence || contract.reference, evidence: part.shape_status || 'Illustrative dimensions' }));
  if (meshes.length !== components.length || meshes.some(mesh => !components.some((part: any) => part.id === mesh.userData.partId))) throw Error('Mechanism components do not match the contract.');
  const clips = new Map(loaded.gltf.animations.map(clip => [clip.name, clip]));
  for (const motion of contract.motions) if (!clips.has(motion.id)) throw Error(`Saved motion is missing: ${motion.id}`);
  runtime.scene.add(root); root.updateMatrixWorld(true); runtime.fit(root);
  const bounds = new THREE.Box3().setFromObject(root);
  const section = createSectionController(meshes, bounds, runtime.render, onChange, runtime.scene);
  const mixer = new THREE.AnimationMixer(root);
  const snapshot: ViewerSnapshot = { status: 'Animated mechanism study ready', appearance: 'inspection', playing: false, motionProgress: 0, motionNote: contract.scope };
  let active: any, action: THREE.AnimationAction, progress = 0, playing = false;
  let isolation: Set<string> | undefined;
  const focus = new Set<string>();
  let focusMode: FocusMode = focusModeOrDefault(context.focusMode);
  let powerPath: any;
  // Helpers follow each animated shaft, including the exploded pose. They are not pick targets.
  const arrows = new THREE.Group(); arrows.name = 'Output rotation arrows'; runtime.scene.add(arrows);
  const arrowBindings: { helper: THREE.Group; mesh: THREE.Mesh; offset: THREE.Vector3 }[] = [];
  for (const output of contract.rotationOutputs || []) {
    const mesh = meshes.find(mesh => mesh.userData.partId === output.id);
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
        const a = meshes.find(mesh => mesh.userData.partId === from), b = meshes.find(mesh => mesh.userData.partId === to);
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
  const applyAppearance = () => {
    const pathColors: Record<string, string> = { housing: '#536878', core: '#84929e', fuel: '#be7b12', 'magneto-left': '#148365', 'magneto-right': '#148365', 'oil-tach': '#1b60bc', starter: '#963f7c', alternator: '#a58b21', vacuum: '#7752a7', governor: '#187f88' };
    // A selected power path ghosts every part outside it; otherwise a lesson step's spotlight is drawn as its focus mode says.
    const spotlight = !powerPath && focus.size > 0;
    snapshot.focusActive = spotlight;
    snapshot.focusMode = focusMode;
    for (const mesh of meshes) {
      const id = mesh.userData.partId;
      const spot = partLook(focusMode, partRole(spotlight, focus.has(id)));
      mesh.visible = spot.visible && (!isolation || isolation.has(id));
      const look = powerPath && !powerPath.parts.includes(id) ? 'ghost' : spot.look;
      for (const material of meshMaterials(mesh) as THREE.MeshStandardMaterial[]) {
        const ghost = look === 'ghost';
        material.opacity = ghost ? XRAY_OPACITY : 1; material.transparent = ghost; material.depthWrite = !ghost;
        material.color.copy(materialColors.get(material)!);
        const part = contract.parts.find((part: any) => part.id === id);
        if (paths.length && snapshot.appearance === 'inspection') material.color.set(part?.role === 'teaching-fixture' ? '#46515a' : pathColors[part?.group] || '#84929e');
        if (paths.length && snapshot.appearance === 'inspection' && /Spring|Plate|Plunger/.test(id)) material.color.set(0x379e9b);
        if (ghost) material.color.set(XRAY_COLOR);
        else if (look === 'pale') material.color.set(PALE_COLOR);
        else if (look === 'highlight') material.color.set(HIGHLIGHT_COLOR);
        material.emissive.set(id === snapshot.selectedId || look === 'highlight' ? HIGHLIGHT_EMISSIVE : powerPath?.parts.includes(id) ? 0x174638 : 0); material.emissiveIntensity = .6;
        material.needsUpdate = true;
      }
    }
    const separate = (contract.remoteDisplays || []).filter((display: any) =>
      components.some((part: any) => part.group === display.group && meshes.some(mesh => mesh.userData.partId === part.id && mesh.visible)));
    snapshot.assemblyNotice = separate.length ? `${separate.map((display: any) => display.label).join(' · ')}: separate relocated displays. Engine connections omitted.` : undefined;
    section.refresh();
    syncHelpers();
  };
  const sample = (value: number) => {
    progress = Math.max(0, Math.min(100, value)); snapshot.motionProgress = progress;
    action.time = clips.get(active.id)!.duration * progress / 100;
    mixer.update(0); root.updateMatrixWorld(true); section.sync(); syncHelpers();
    const stage = [...active.stages].reverse().find((stage: any) => progress >= stage.progress);
    snapshot.motionStage = stage?.label || active.label;
    snapshot.motionNote = `${stage?.note || ''} ${contract.scope}`;
    runtime.render(); onChange();
  };
  const setPlaying = (value: boolean) => {
    playing = value; snapshot.playing = value;
    if (value && progress >= 100) sample(0);
    runtime.setAnimationCallback(value ? elapsed => {
      const next = progress + elapsed * 100 / Math.max(clips.get(active.id)!.duration, .1);
      if (next >= 100 && !active.loop) { sample(100); playing = false; snapshot.playing = false; onChange(); return false; }
      sample(active.loop ? next % 100 : next); return playing;
    } : undefined); onChange();
  };
  const selectMotion = (id: string) => {
    const motion = contract.motions.find((motion: any) => motion.id === id);
    if (!motion) throw Error(`Unknown saved motion: ${id}`);
    setPlaying(false); mixer.stopAllAction(); active = motion;
    action = mixer.clipAction(clips.get(id)!); action.reset().setLoop(THREE.LoopOnce, 1).play(); action.clampWhenFinished = true; action.paused = true;
    snapshot.savedMotionId = id;
    // Use the union of both assembly extremes for cuts and framing in either direction.
    sample(0); const motionBounds = new THREE.Box3().setFromObject(root);
    sample(100); motionBounds.union(new THREE.Box3().setFromObject(root)); section.updateBounds(motionBounds);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...motionBounds.getSize(new THREE.Vector3()).toArray())); proxy.position.copy(motionBounds.getCenter(new THREE.Vector3())); runtime.fit(proxy); proxy.geometry.dispose(); sample(0);
  };
  const fitVisible = () => {
    const box = new THREE.Box3(); for (const mesh of meshes) if (mesh.visible) box.expandByObject(mesh);
    if (box.isEmpty()) return;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray())); proxy.position.copy(box.getCenter(new THREE.Vector3())); runtime.fit(proxy); proxy.geometry.dispose();
  };
  const select = (id: string) => {
    const part = components.find((part: any) => part.id === id);
    snapshot.selectedId = part?.id; snapshot.selectedLabel = part?.label; snapshot.selectedDescription = part?.description;
    applyAppearance(); onChange();
  };
  const showAll = () => { isolation = undefined; focus.clear(); powerPath = undefined; snapshot.powerPathId = ''; snapshot.powerPathNote = ''; snapshot.isolated = false; select(''); fitVisible(); };
  runtime.setPickTargets(meshes, object => select(object.userData.partId));
  const update = (view: any) => {
    powerPath = undefined; snapshot.powerPathId = ''; snapshot.powerPathNote = '';
    focus.clear(); for (const id of view.focusParts || []) focus.add(id);
    focusMode = focusModeOrDefault(view.focusMode);
    isolation = undefined; snapshot.isolated = false;
    selectMotion(view.savedMotionId || contract.motions[0].id); sample(view.motionProgress || 0); applyAppearance();
  };
  update(context);
  return {
    snapshot: () => ({ ...snapshot, ...section.snapshot() }), update,
    features: {
      focus: { setMode(mode) { focusMode = focusModeOrDefault(mode); applyAppearance(); onChange(); } },
      ...(paths.length ? { powerPaths: { items: paths.map(path => ({ id: path.id, label: path.label })), select(id: string) {
        powerPath = paths.find(path => path.id === id); snapshot.powerPathId = powerPath?.id || '';
        snapshot.powerPathNote = powerPath ? `${powerPath.note} Output direction: ${powerPath.direction}. ${powerPath.ratio === null ? 'Speed ratio unverified.' : `Drive / crank speed = ${powerPath.ratio}:1; at 1000 crank RPM: ${powerPath.ratio * 1000} drive RPM (${powerPath.id === 'starter' ? 'cranking only' : 'speed example'}).`} ${contract.viewpoint} Dashed lines are a conceptual path, not physical shaft geometry.` : '';
        applyAppearance(); onChange();
      }, isolate() { if (!powerPath) return; isolation = new Set(powerPath.parts); snapshot.isolated = true; applyAppearance(); fitVisible(); onChange(); } } } : {}),
      components: { items: components, groups: [{ id: '', label: 'All groups' }, ...(contract.groups ? contract.groups.map((group: any) => ({ id: group.id, label: `${group.depth ? '– ' : ''}${group.label}` })) : [...new Set<string>(components.map((part: any) => part.group))].map(id => ({ id, label: id.replaceAll('-', ' ') }))), ...paths.map(path => ({ id: `path:${path.id}`, label: `Complete path: ${path.label}` }))], select,
        isolate() { if (!snapshot.selectedId) return; isolation = new Set([snapshot.selectedId]); snapshot.isolated = true; applyAppearance(); fitVisible(); },
        isolateGroup(id) { if (!id) return; const ids = groupComponentIds(components, id); if (!ids.length) return; powerPath = undefined; snapshot.powerPathId = ''; snapshot.powerPathNote = ''; isolation = new Set(ids); snapshot.isolated = true; select(''); fitVisible(); }, showAll },
      savedMotions: { items: contract.motions, select: selectMotion, setProgress(value) { setPlaying(false); sample(value); }, step(direction) {
        const stops = active.stages.map((stage: any) => stage.progress).sort((a: number, b: number) => a - b);
        setPlaying(false); sample(direction > 0 ? stops.find((value: number) => value > progress + .01) ?? 100 : [...stops].reverse().find((value: number) => value < progress - .01) ?? 0);
      } },
      motion: { setAngle: sample, setPlaying, reset() { setPlaying(false); sample(0); } }, section: section.feature,
      appearance: { setMode(mode) { snapshot.appearance = mode; applyAppearance(); } },
    },
    dispose() { setPlaying(false); runtime.setPickTargets([]); mixer.stopAllAction(); mixer.uncacheRoot(root); section.dispose(); runtime.scene.remove(root, arrows, route); disposeObject(root); disposeObject(arrows); disposeObject(route); },
  };
}
