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

export interface ExploreAssembly {
  id: string;
  name: string;
  modelKey: string;
  subtitle: string;
  description: string;
  badge: string;
  componentCount: number;
  imageType: 'piston' | 'wright' | 'radial' | 'systems';
  tags: string[];
}

export interface LessonStep {
  type?: 'text' | 'image' | 'model-pose' | 'external-link' | 'web-embed';
  stepNumber: number;
  title: string;
  text: string;
  imageType: 'steam' | 'oxen' | 'wright' | 'piston' | 'systems' | 'gauges' | 'borescope' | 'radial';
  promptQuestion?: string;
  promptPlaceholder?: string;
  suggestedAnswer?: string;
  has3DReference?: boolean;
  referenceModel?: string;
  note?: string;
  action?: {
    type: string;
    value?: number | string;
  };
  url?: string;
  sourceRefs?: string[];
  mediaPlan?: {
    mode: 'none' | 'source-image' | 'native-html' | 'existing-3d' | 'web-media' | 'imagegen';
    status: 'not-needed' | 'available' | 'planned' | 'needs-review';
    rationale: string;
    assetBrief?: string;
  };
}

export interface Lesson {
  id: string;
  lessonNumber: string;
  title: string;
  subtitle: string;
  description: string;
  stepCount: number;
  hasModelBadge?: boolean;
  imageType: 'oxen' | 'wright' | 'piston' | 'systems' | 'maintenance' | 'gauges' | 'borescope';
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
  imageType: 'radial' | 'systems' | 'maintenance' | 'gauges' | 'borescope';
  lessons: Lesson[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  scenario?: string;
  type?: 'multiple-choice' | 'ordering';
  options: string[];
  correctIndex: number;
  items?: string[];
  hint?: string;
  explanation: string;
  category: '4stroke' | 'components' | 'diagnostics';
}

export interface QuizModule {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: '4stroke' | 'components' | 'diagnostics' | 'all';
  questionCount: number;
  approxMinutes: string;
  badge: string;
  imageType: 'radial' | 'piston' | 'maintenance' | 'gauges' | 'borescope';
  questions: QuizQuestion[];
}
