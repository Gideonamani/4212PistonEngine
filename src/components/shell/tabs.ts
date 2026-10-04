import { Box, BookOpen, CheckCircle, type LucideIcon } from 'lucide-react';
import type { ViewMode } from '../../types/engine';

/** The three modes of the app, with the long name the desktop header uses and the short one for a phone's bottom bar. */
export const VIEW_TABS: { view: ViewMode; icon: LucideIcon; longLabel: string; shortLabel: string }[] = [
  { view: 'explore', icon: Box, longLabel: '3D Explore', shortLabel: 'Explore' },
  { view: 'learn', icon: BookOpen, longLabel: 'Guided Lessons', shortLabel: 'Learn' },
  { view: 'check', icon: CheckCircle, longLabel: 'Knowledge Check', shortLabel: 'Check' },
];
