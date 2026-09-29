import * as THREE from 'three';
import type { ModelDefinition } from '../../data/modelRegistry';
import { loadGltf } from '../core/assets';
import { disposeObject } from '../core/modelUtils';
import type { AdapterContext, ViewerSession, ViewerSnapshot } from '../types';

export async function createStaticGltfSession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  const { runtime, signal, onChange, onProgress } = context;
  const { gltf } = await loadGltf(definition.sources || [], signal, onProgress);
  signal.throwIfAborted();
  const root = gltf.scene;
  runtime.scene.add(root);
  const fitPreset = (viewPreset?: string) => {
    const preset = viewPreset && definition.viewPresets?.[viewPreset];
    runtime.fit(root, preset ? new THREE.Vector3(...preset.direction) : undefined);
  };
  fitPreset(context.viewPreset);
  const allHotspots = definition.hotspots || [];
  const visibleHotspots = (focusHotspots?: string[]) => {
    const permitted = focusHotspots?.length ? focusHotspots : context.profile === 'explore' ? undefined : definition.lessonHotspotIds;
    return permitted?.length ? allHotspots.filter((hotspot) => permitted.includes(hotspot.id)) : allHotspots;
  };
  const hotspots = { items: visibleHotspots(context.focusHotspots) };
  const snapshot: ViewerSnapshot = { status: `${definition.label} ready`, progress: 100 };

  return {
    snapshot: () => ({ ...snapshot }),
    update(view) {
      fitPreset(view.viewPreset);
      hotspots.items = visibleHotspots(view.focusHotspots);
      snapshot.activeHotspotId = undefined;
      onChange();
    },
    features: {
      hotspots: {
        get items() { return hotspots.items; },
        focus(id: string) {
          const hotspot = allHotspots.find((item) => item.id === id);
          if (!hotspot) return;
          snapshot.activeHotspotId = id;
          runtime.focus(new THREE.Vector3(...hotspot.position));
          onChange();
        },
      },
    },
    dispose() {
      runtime.scene.remove(root);
      disposeObject(root);
    },
  };
}
