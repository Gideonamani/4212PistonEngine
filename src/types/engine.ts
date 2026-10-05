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
/** The three modes in the tab bar, plus the Credits page, which belongs to no tab. */
export type AppScreen = ViewMode | 'credits';
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
  /** Wide 2:1 image for the top of the course page; the course page has no picture when it is absent. */
  banner?: string;
  lessons: Lesson[];
  /** Unlisted lessons linked from a step; opened by route or link, absent from the lesson list. */
  deepDives?: Lesson[];
}

/** What every Check question has, whatever its type. */
interface QuizQuestionBase {
  id: string;
  lessonId?: string;
  question: string;
  hint?: string;
  explanation: string;
}

export interface ChoiceQuestion extends QuizQuestionBase { type: 'multiple-choice'; options: string[]; correctIndex: number }
/** `items` are in the correct order; the screen shuffles them for display. */
export interface OrderingQuestion extends QuizQuestionBase { type: 'ordering'; items: string[] }
/** Each left-hand term goes with its right-hand text. */
export interface MatchingQuestion extends QuizQuestionBase { type: 'matching'; pairs: { left: string; right: string }[] }
/** The learner types a number; any value within `tolerance` of `correctValue` is right. */
export interface NumericQuestion extends QuizQuestionBase { type: 'numeric'; unit: string; correctValue: number; tolerance: number }

export type QuizQuestion = ChoiceQuestion | OrderingQuestion | MatchingQuestion | NumericQuestion;
export type QuizQuestionType = QuizQuestion['type'];

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
