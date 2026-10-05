import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * The one way the app builds a glTF loader. It can read plain GLB files and ones packed with EXT_meshopt_compression (a lossless
 * vertex and index codec, so geometry decodes to exactly what was encoded).
 */
export function createGltfLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
