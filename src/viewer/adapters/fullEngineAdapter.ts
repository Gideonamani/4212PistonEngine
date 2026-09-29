import * as THREE from 'three';
import type { ModelDefinition, ModelSource } from '../../data/modelRegistry';
import { loadGltf } from '../core/assets';
import { cloneMaterials, createSectionController, disposeObject, meshMaterials } from '../core/modelUtils';
import type { AdapterContext, AppearanceMode, ModelComponent, ModelGroup, ViewerSession, ViewerSnapshot } from '../types';

type EngineItem = {
  mesh: THREE.Mesh;
  label: string;
  binding: Record<string, unknown>;
  materials: THREE.MeshStandardMaterial[];
};

function selectorMatches(item: EngineItem, selector: any) {
  return Boolean(selector?.all || selector?.any_regex?.some((pattern: string) => new RegExp(pattern, 'i').test(item.label)));
}

function bindingMatches(item: EngineItem, target: any) {
  const binding = target?.stable_binding || target?.binding;
  if (binding && Object.keys(item.binding).length) return Object.entries(binding).every(([key, value]) => item.binding[key] === value);
  return selectorMatches(item, target?.selector);
}

export async function createFullEngineSession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  const { runtime, signal, onChange, onProgress } = context;
  const response = await fetch(definition.contractUrl!, { signal });
  if (!response.ok) throw Error('The full-engine contract is unavailable.');
  const contract = await response.json();
  const transport = contract.asset.transport;
  const sources: ModelSource[] = transport ? [
    { localUrl: transport.web_url, driveId: transport.drive_file_id, compressed: transport.encoding === 'gzip', transferBytes: transport.bytes, decodedBytes: contract.asset.bytes },
    { localUrl: transport.fallback_web_url, driveId: transport.fallback_drive_file_id, transferBytes: contract.asset.bytes, decodedBytes: contract.asset.bytes },
  ] : [{ localUrl: contract.asset.web_url, transferBytes: contract.asset.bytes }];
  const loaded = await loadGltf(sources, signal, onProgress);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', loaded.bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== contract.asset.sha256) throw Error('This full-engine asset does not match its published contract.');
  signal.throwIfAborted();

  const root = loaded.gltf.scene;
  cloneMaterials(root);
  const items: EngineItem[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const lineage: string[] = [];
    const binding: Record<string, unknown> = {};
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) {
      lineage.push(node.name || '');
      for (const key of ['engine_id', 'module_id', 'instance_id']) if (node.userData?.[key] !== undefined && binding[key] === undefined) binding[key] = node.userData[key];
    }
    const materials = meshMaterials(mesh) as THREE.MeshStandardMaterial[];
    for (const material of materials) material.userData.originalColor = material.color?.clone();
    items.push({ mesh, label: lineage.join(' / '), binding, materials });
  });
  if (!items.length) throw Error('The published full engine contains no selectable geometry.');

  runtime.scene.add(root);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  runtime.fit(root, new THREE.Vector3(1.3, 0.8, 1.55));

  const clip = new THREE.AnimationClip('shared-engine-action', -1, loaded.gltf.animations.flatMap((animation) => animation.tracks));
  if (!clip.tracks.length) throw Error('The published full engine contains no operating action.');
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();

  const componentsById = new Map<string, any>(contract.teaching_components.map((component: any) => [component.id, component]));
  const snapshot: ViewerSnapshot = {
    status: 'Full six-cylinder engine ready',
    progress: 100,
    appearance: 'inspection',
    angle: context.initialAngle ?? 0,
    playing: false,
    motionNote: '',
    sectionEnabled: false,
    sectionAxis: 'z',
    sectionPosition: 50,
    sectionFlipped: true,
  };
  let selectedId = '';
  let isolatedId = '';
  let playing = false;
  const section = createSectionController(items.map((item) => item.mesh), bounds, runtime.render, onChange);

  const selectedComponent = () => componentsById.get(selectedId);
  const applyVisibility = () => {
    const isolated = componentsById.get(isolatedId);
    for (const item of items) item.mesh.visible = !isolated || bindingMatches(item, isolated);
  };
  const applyAppearance = () => {
    const selected = selectedComponent();
    for (const item of items) {
      const highlighted = Boolean(selected && bindingMatches(item, selected));
      for (const material of item.materials) {
        if (snapshot.appearance === 'inspection') {
          material.color.set(
            /Intake/i.test(item.label) ? 0x379e9b
              : /Exhaust/i.test(item.label) ? 0xbc7353
                : /V5 /i.test(item.label) ? 0x748694
                  : /crank|gear|shaft/i.test(item.label) ? 0x596d80
                    : 0x9cabb8,
          );
        } else if (material.userData.originalColor) material.color.copy(material.userData.originalColor);
        if (material.emissive) {
          material.emissive.set(highlighted ? 0x087567 : 0x000000);
          material.emissiveIntensity = highlighted ? 0.72 : 0;
        }
      }
    }
    section.refresh();
  };

  const select = (id: string) => {
    selectedId = id;
    isolatedId = '';
    const component = componentsById.get(id);
    snapshot.selectedId = id || undefined;
    snapshot.selectedLabel = component?.label;
    snapshot.selectedDescription = component?.description;
    snapshot.isolated = false;
    applyVisibility();
    applyAppearance();
    onChange();
  };

  const componentForItem = (item: EngineItem) => contract.teaching_components
    .filter((component: any) => bindingMatches(item, component))
    .sort((left: any, right: any) => JSON.stringify(right.selector).length - JSON.stringify(left.selector).length)[0];
  runtime.setPickTargets(items.map((item) => item.mesh), (object) => {
    const item = items.find((candidate) => candidate.mesh === object);
    const component = item && componentForItem(item);
    if (component) select(component.id);
  });

  const setAngle = (value: number) => {
    const angle = ((value % 720) + 720) % 720;
    snapshot.angle = angle;
    mixer.setTime(clip.duration * angle / 720);
    const stroke = angle < 180 ? 'Power' : angle < 360 ? 'Exhaust' : angle < 540 ? 'Intake' : 'Compression';
    snapshot.motionNote = `${stroke} stroke · all engine motion is sampled from the shared 720° action.`;
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
  setAngle(snapshot.angle || 0);
  applyAppearance();

  const components: ModelComponent[] = contract.teaching_components.map((component: any) => ({
    id: component.id,
    label: component.label,
    description: component.description,
    group: component.group,
    source: contract.source?.scene,
    evidence: contract.status,
  }));
  const groups: ModelGroup[] = contract.inspection_groups.map((group: any) => ({ id: group.id, label: group.label }));

  return {
    snapshot: () => ({ ...snapshot, ...section.snapshot() }),
    features: {
      components: {
        items: components,
        groups,
        select,
        isolate() {
          if (!selectedId) return;
          isolatedId = selectedId;
          snapshot.isolated = true;
          applyVisibility();
          const component = selectedComponent();
          const box = new THREE.Box3();
          for (const item of items) if (component && bindingMatches(item, component)) box.expandByObject(item.mesh);
          if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
            proxy.position.copy(center);
            runtime.fit(proxy);
            proxy.geometry.dispose();
          }
          runtime.render();
          onChange();
        },
        showAll() {
          selectedId = '';
          isolatedId = '';
          snapshot.selectedId = undefined;
          snapshot.selectedLabel = undefined;
          snapshot.selectedDescription = undefined;
          snapshot.isolated = false;
          applyVisibility();
          applyAppearance();
          runtime.fit(root, new THREE.Vector3(1.3, 0.8, 1.55));
          onChange();
        },
      },
      motion: { setAngle: (angle) => { setPlaying(false); setAngle(angle); }, setPlaying, reset: () => { setPlaying(false); setAngle(0); } },
      section: section.feature,
      appearance: { setMode(mode: AppearanceMode) { snapshot.appearance = mode; applyAppearance(); onChange(); } },
    },
    dispose() {
      playing = false;
      runtime.setAnimationCallback(undefined);
      runtime.setPickTargets([]);
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      runtime.scene.remove(root);
      disposeObject(root);
    },
  };
}
