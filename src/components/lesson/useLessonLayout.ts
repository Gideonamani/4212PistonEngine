import { useStoredChoice } from '../../data/localChoice';
import { useMediaQuery } from './useMediaQuery';
import { LESSON_LAYOUTS, SIDE_BY_SIDE_QUERY, effectiveLayout, type LessonLayout } from './layout.mjs';

export type { LessonLayout };

const LAYOUT_CHOICE_KEY = '4212-lesson-layout';

/**
 * How the lesson lays out its viewer and text. `canChoose` is true only where side by side is possible (a wide landscape screen), and
 * that is when the lesson offers the toggle. The learner's pick is remembered on this device.
 */
export function useLessonLayout() {
  const roomForSideBySide = useMediaQuery(SIDE_BY_SIDE_QUERY);
  const [choice, choose] = useStoredChoice<LessonLayout>(LAYOUT_CHOICE_KEY, LESSON_LAYOUTS as LessonLayout[]);
  return { layout: effectiveLayout({ roomForSideBySide, choice }), canChoose: roomForSideBySide, choose };
}
