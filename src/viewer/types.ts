import type * as THREE from 'three';

export type ViewerProfile = 'explore' | 'lesson-dynamic' | 'lesson-reference';
export type InteractionMode = 'orbit' | 'pan';
export type SectionAxis = 'x' | 'y' | 'z';
export type AppearanceMode = 'inspection' | 'cad';
/** How a spotlight (a step's focusParts) draws attention: colour the parts, x-ray the rest, or isolate the parts. See core/focus-style.mjs. */
export type FocusMode = 'highlight' | 'xray' | 'isolate';

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
  groups?: string[];
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
  assemblyNotice?: string;
  cycleEnabled?: boolean;
  cycleNote?: string;
  sectionEnabled?: boolean;
  sectionAxis?: SectionAxis;
  sectionPosition?: number;
  sectionFlipped?: boolean;
  activeHotspotId?: string;
  savedMotionId?: string;
  motionProgress?: number;
  motionStage?: string;
  powerPathId?: string;
  powerPathNote?: string;
  /** Whether a spotlight is active, and how it is drawn. Only models that spotlight parts report them. */
  focusActive?: boolean;
  focusMode?: FocusMode;
};

export type ViewerFeatures = {
  powerPaths?: {
    items: { id: string; label: string }[];
    select: (id: string) => void;
    isolate: () => void;
  };
  components?: {
    items: ModelComponent[];
    groups: ModelGroup[];
    select: (id: string) => void;
    isolate: () => void;
    isolateGroup?: (groupId: string) => void;
    showAll: () => void;
  };
  motion?: {
    setAngle: (angle: number) => void;
    setPlaying: (playing: boolean) => void;
    reset: () => void;
  };
  savedMotions?: {
    items: { id: string; label: string; stages: { label: string; progress: number; note?: string }[] }[];
    select: (id: string) => void;
    setProgress: (value: number) => void;
    step: (direction: number) => void;
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
  /** Change how the current spotlight is drawn, until the next step sets its own. Does nothing while no spotlight is active. */
  focus?: {
    setMode: (mode: FocusMode) => void;
  };
};

/** The per-step view a lesson can change on an already-loaded model, so consecutive steps do not reload the scene. */
export type ViewUpdate = {
  savedMotionId?: string;
  motionProgress?: number;
  initialAngle?: number;
  initialCycle?: boolean;
  viewPreset?: string;
  focusHotspots?: string[];
  focusParts?: string[];
  /** How focusParts is drawn; omitted means x-ray. */
  focusMode?: FocusMode;
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
