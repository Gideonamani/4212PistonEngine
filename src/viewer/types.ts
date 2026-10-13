import type * as THREE from 'three';

export type ViewerProfile = 'explore' | 'lesson-dynamic' | 'lesson-reference';
export type InteractionMode = 'orbit' | 'pan';
export type SectionAxis = 'x' | 'y' | 'z';
/**
 * A section plane a lesson step recommends. `normal` points toward the half that is cut away, in the model's own axes; `offset` (0 to 1,
 * default 0.5) is where the plane sits across the model along that normal, 0.5 being the middle. See web/schema/content-schema.mjs.
 */
export type SectionPlaneSpec = { label: string; normal: [number, number, number]; offset?: number };
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
  /** The label of the plane this lesson step recommends for cutting, if it names one, and whether it is the plane in force. */
  sectionRecommended?: string;
  sectionOnRecommended?: boolean;
  activeHotspotId?: string;
  savedMotionId?: string;
  motionProgress?: number;
  motionStage?: string;
  /** The playback speed (1 is normal) and whether the motion in view repeats when it reaches its end. */
  motionSpeed?: number;
  motionLoop?: boolean;
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
    /** Playback speed as a multiple of normal, for the crank and for saved motions alike. */
    setSpeed?: (speed: number) => void;
    /** Whether the motion in view starts again when it reaches its end (the crank goes round and round; a saved motion stops). */
    setLoop?: (loop: boolean) => void;
    /** The strokes of the cycle over the crank's 720 degrees, in angle order, for naming the scrubber's track. */
    strokes?: { label: string; start: number; end: number }[];
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
    /** Switch to the plane the current lesson step recommends. Does nothing when it names none. */
    useRecommended: () => void;
  };
  appearance?: {
    setMode: (mode: AppearanceMode) => void;
  };
  hotspots?: {
    items: ModelHotspot[];
    focus: (id: string) => void;
  };
  /** The spotlight: parts drawn apart from the rest, as one of the three modes says. */
  focus?: {
    /** Change how the current spotlight is drawn, until the next step sets its own. Does nothing while no spotlight is active. */
    setMode: (mode: FocusMode) => void;
    /**
     * Explore: spotlight these parts (an empty list clears the spotlight), drawn as `mode`. Unlike a lesson step's focusParts it leaves the
     * selection where it is, so the learner can keep choosing parts while the spotlight follows, and it moves the camera only to bring an
     * isolated part into frame.
     */
    set: (ids: string[], mode: FocusMode) => void;
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
  /** A plane chosen for seeing this step's component best, offered beside X, Y and Z in the section controls. */
  sectionPlane?: SectionPlaneSpec;
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
