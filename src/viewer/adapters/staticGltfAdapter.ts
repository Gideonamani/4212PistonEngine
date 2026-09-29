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
  const preset = context.viewPreset && definition.viewPresets?.[context.viewPreset];
  runtime.fit(root, preset ? new THREE.Vector3(...preset.direction) : undefined);
  const allHotspots = definition.hotspots || [];
  const permitted = context.focusHotspots?.length ? context.focusHotspots : context.profile === 'explore' ? undefined : definition.lessonHotspotIds;
  const hotspots = permitted?.length ? allHotspots.filter((hotspot) => permitted.includes(hotspot.id)) : allHotspots;
  const snapshot: ViewerSnapshot = { status: `${definition.label} ready`, progress: 100 };

  return {
    snapshot: () => ({ ...snapshot }),
    features: {
      hotspots: {
        items: hotspots,
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
