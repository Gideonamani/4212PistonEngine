import * as THREE from 'three';
import type { ModelDefinition } from '../../data/modelRegistry';
import type { AdapterContext, ViewerSession, ViewerSnapshot } from '../types';
import { loadGltf } from '../core/assets';
import { cloneMaterials, createSectionController, disposeObject, meshMaterials } from '../core/modelUtils';
import { groupComponentIds } from '../core/component-groups.mjs';

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
  const components = contract.parts.map((part: any) => ({ id: part.id, label: part.label, group: part.group, description: part.description, source: contract.reference, evidence: 'Illustrative dimensions' }));
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
  const materialColors = new Map<THREE.Material, THREE.Color>();
  for (const mesh of meshes) for (const material of meshMaterials(mesh) as THREE.MeshStandardMaterial[]) materialColors.set(material, material.color.clone());
  const applyAppearance = () => {
    for (const mesh of meshes) {
      mesh.visible = !isolation || isolation.has(mesh.userData.partId);
      for (const material of meshMaterials(mesh) as THREE.MeshStandardMaterial[]) {
        const ghost = focus.size > 0 && !focus.has(mesh.userData.partId);
        material.opacity = ghost ? .12 : 1; material.transparent = ghost; material.depthWrite = !ghost;
        material.color.copy(materialColors.get(material)!);
        if (snapshot.appearance === 'inspection' && /Spring|Plate|Plunger/.test(mesh.userData.partId)) material.color.set(0x379e9b);
        material.emissive.set(mesh.userData.partId === snapshot.selectedId ? 0x087567 : 0); material.emissiveIntensity = .6;
        material.needsUpdate = true;
      }
    }
    section.refresh();
  };
  const sample = (value: number) => {
    progress = Math.max(0, Math.min(100, value)); snapshot.motionProgress = progress;
    action.time = clips.get(active.id)!.duration * progress / 100;
    mixer.update(0); root.updateMatrixWorld(true); section.sync();
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
    snapshot.savedMotionId = id; sample(id === 'Exploded overview' ? 100 : 0); section.updateBounds(new THREE.Box3().setFromObject(root)); runtime.fit(root); if (id === 'Exploded overview') sample(0);
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
  const showAll = () => { isolation = undefined; focus.clear(); snapshot.isolated = false; select(''); fitVisible(); };
  runtime.setPickTargets(meshes, object => select(object.userData.partId));
  const update = (view: any) => {
    focus.clear(); for (const id of view.focusParts || []) focus.add(id);
    isolation = undefined; snapshot.isolated = false;
    selectMotion(view.savedMotionId || contract.motions[0].id); sample(view.motionProgress || 0); applyAppearance();
  };
  update(context);
  return {
    snapshot: () => ({ ...snapshot, ...section.snapshot() }), update,
    features: {
      components: { items: components, groups: [{ id: '', label: 'All groups' }, ...[...new Set<string>(components.map((part: any) => part.group))].map(id => ({ id, label: id.replaceAll('-', ' ') }))], select,
        isolate() { if (!snapshot.selectedId) return; isolation = new Set([snapshot.selectedId]); snapshot.isolated = true; applyAppearance(); fitVisible(); },
        isolateGroup(id) { if (!id) return; const ids = groupComponentIds(components, id); if (!ids.length) return; isolation = new Set(ids); snapshot.isolated = true; select(''); fitVisible(); }, showAll },
      savedMotions: { items: contract.motions, select: selectMotion, setProgress(value) { setPlaying(false); sample(value); }, step(direction) {
        const stops = active.stages.map((stage: any) => stage.progress).sort((a: number, b: number) => a - b);
        setPlaying(false); sample(direction > 0 ? stops.find((value: number) => value > progress + .01) ?? 100 : [...stops].reverse().find((value: number) => value < progress - .01) ?? 0);
      } },
      motion: { setAngle: sample, setPlaying, reset() { setPlaying(false); sample(0); } }, section: section.feature,
      appearance: { setMode(mode) { snapshot.appearance = mode; applyAppearance(); } },
    },
    dispose() { setPlaying(false); runtime.setPickTargets([]); mixer.stopAllAction(); mixer.uncacheRoot(root); section.dispose(); runtime.scene.remove(root); disposeObject(root); },
  };
}
