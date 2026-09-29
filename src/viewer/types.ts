import type * as THREE from 'three';

export type ViewerProfile = 'explore' | 'lesson-dynamic' | 'lesson-reference' | 'assessment';
export type InteractionMode = 'orbit' | 'pan';
export type SectionAxis = 'x' | 'y' | 'z';
export type AppearanceMode = 'inspection' | 'cad';

export type ModelHotspot = {
  id: string;
  label: string;
  description: string;
  position: [number, number, number];
};

export type ModelComponent = {
  id: string;
  label: string;
  description: string;
  group: string;
  source?: string;
  evidence?: string;
};

export type ModelGroup = {
  id: string;
  label: string;
};

export type ViewerSnapshot = {
  status: string;
  progress?: number;
  selectedId?: string;
  selectedLabel?: string;
  selectedDescription?: string;
  isolated?: boolean;
  appearance?: AppearanceMode;
  angle?: number;
  playing?: boolean;
  motionNote?: string;
  cycleEnabled?: boolean;
  cycleNote?: string;
  sectionEnabled?: boolean;
  sectionAxis?: SectionAxis;
  sectionPosition?: number;
  sectionFlipped?: boolean;
  activeHotspotId?: string;
};

export type ViewerFeatures = {
  components?: {
    items: ModelComponent[];
    groups: ModelGroup[];
    select: (id: string) => void;
    isolate: () => void;
    showAll: () => void;
  };
  motion?: {
    setAngle: (angle: number) => void;
    setPlaying: (playing: boolean) => void;
    reset: () => void;
  };
  cycleCues?: {
    setEnabled: (enabled: boolean) => void;
  };
  section?: {
    setEnabled: (enabled: boolean) => void;
    setAxis: (axis: SectionAxis) => void;
    setPosition: (position: number) => void;
    flip: () => void;
    reset: () => void;
  };
  appearance?: {
    setMode: (mode: AppearanceMode) => void;
  };
  hotspots?: {
    items: ModelHotspot[];
    focus: (id: string) => void;
  };
};

/** The per-step view a lesson can change on an already-loaded model, so consecutive steps do not reload the scene. */
export type ViewUpdate = {
  initialAngle?: number;
  initialCycle?: boolean;
  viewPreset?: string;
  focusHotspots?: string[];
  focusParts?: string[];
};

export type ViewerSession = {
  features: ViewerFeatures;
  snapshot: () => ViewerSnapshot;
  update?: (view: ViewUpdate) => void;
  dispose: () => void;
};

export type ViewerRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
  render: () => void;
  fit: (object: THREE.Object3D, direction?: THREE.Vector3, padding?: number) => void;
  focus: (target: THREE.Vector3, distance?: number) => void;
  resetView: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setPickTargets: (objects: THREE.Object3D[], onPick?: (object: THREE.Object3D, point: THREE.Vector3) => void) => void;
  setAnimationCallback: (callback?: (elapsedSeconds: number) => boolean) => void;
  dispose: () => void;
};

export type AdapterContext = ViewUpdate & {
  runtime: ViewerRuntime;
  profile: ViewerProfile;
  signal: AbortSignal;
  onChange: () => void;
  onProgress: (status: string, progress?: number) => void;
};
