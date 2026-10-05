export interface EngineComponent {
  id: string;
  name: string;
  shortDesc: string;
  group: 'combustion' | 'valves' | 'reciprocating' | 'cooling' | 'ignition';
  groupName: string;
  description: string;
  material: string;
  operatingTemp: string;
  clearances: string;
  failureModes: string[];
  maintenanceTip: string;
  color: string;
  pinpointPosition: [number, number, number]; // 3D coordinates on model
  explodedOffset: [number, number, number];
}

export type ViewMode = 'explore' | 'learn' | 'check';
export type DrawerTab = 'components' | 'motion' | 'lookInside' | 'appearance';
export type AppearanceMode = 'realistic' | 'cutaway' | 'thermal' | 'xray' | 'schematic';
export type CyclePhase = 'intake' | 'compression' | 'power' | 'exhaust';

export interface LessonStep {
  type?: 'text' | 'image' | 'model-pose' | 'external-link' | 'web-embed';
  stepNumber: number;
  title: string;
  text: string;
  promptQuestion?: string;
  promptPlaceholder?: string;
  suggestedAnswer?: string;
  has3DReference?: boolean;
  modelId?: string;
  savedMotionId?: string;
  motionProgress?: number;
  referenceModel?: string;
  viewPreset?: string;
  focusHotspots?: string[];
  /** Component ids spotlighted in the 3D view; the other parts are de-emphasised as focusMode says. */
  focusParts?: string[];
  /** How the spotlight looks: 'highlight' colours the parts and greys the rest, 'xray' (the default) ghosts the rest, 'isolate' hides the rest. */
  focusMode?: 'highlight' | 'xray' | 'isolate';
  /** Ids of unlisted deep-dive lessons this step links to (optional, never required to progress). */
  deepDiveLinks?: string[];
  note?: string;
  action?: {
    type: string;
    value?: number | string;
  };
  url?: string;
  alt?: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
  sourceRefs?: string[];
  mediaPlan?: {
    mode: 'none' | 'source-image' | 'native-html' | 'existing-3d' | 'web-media' | 'imagegen';
    status: 'not-needed' | 'available' | 'planned' | 'needs-review';
    rationale: string;
    assetBrief?: string;
  };
}

/** Where a lesson stands with the instructor: students see a pending chip until it is 'reviewed'. */
export type LessonReviewStatus = 'unreviewed' | 'reviewed';

export interface Lesson {
  id: string;
  lessonNumber: string;
  title: string;
  subtitle: string;
  description: string;
  stepCount: number;
  hasModelBadge?: boolean;
  reviewStatus: LessonReviewStatus;
  /** YYYY-MM-DD, present only when reviewStatus is 'reviewed'. */
  reviewedOn?: string;
  /** Card image from the lesson pack; a neutral placeholder stands in when it is absent. */
  thumbnail?: string;
  /** True for an unlisted lesson reached only through a step's deepDiveLinks. */
  isDeepDive?: boolean;
  steps: LessonStep[];
}

export interface CourseTrack {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  stepCountApprox: string;
  progressPercent: number;
  isCurrent?: boolean;
  thumbnail?: string;
  lessons: Lesson[];
  /** Unlisted lessons linked from a step; opened by route or link, absent from the lesson list. */
  deepDives?: Lesson[];
}

export interface QuizQuestion {
  id: string;
  lessonId?: string;
  question: string;
  scenario?: string;
  type?: 'multiple-choice' | 'ordering';
  options: string[];
  correctIndex: number;
  items?: string[];
  hint?: string;
  explanation: string;
}

export interface QuizModule {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  questionCount: number;
  approxMinutes: string;
  thumbnail?: string;
  questions: QuizQuestion[];
}
