import type { ModelDefinition } from '../../data/modelRegistry';
import type { AdapterContext, ViewerSession } from '../types';

export async function createModelSession(definition: ModelDefinition, context: AdapterContext): Promise<ViewerSession> {
  if (definition.adapter === 'static-gltf') {
    const { createStaticGltfSession } = await import('./staticGltfAdapter');
    return createStaticGltfSession(definition, context);
  }
  if (definition.adapter === 'operating-cylinder') {
    const { createCylinderSession } = await import('./cylinderAdapter');
    return createCylinderSession(definition, context);
  }
  if (definition.adapter === 'full-engine') {
    const { createFullEngineSession } = await import('./fullEngineAdapter');
    return createFullEngineSession(definition, context);
  }
  throw Error(`Unsupported model adapter: ${(definition as ModelDefinition).adapter}`);
}

