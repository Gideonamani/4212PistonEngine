import React from 'react';
import { ChevronUp } from 'lucide-react';
import { CardThumbnail } from '../CardThumbnail';

/** The strip pinned to the bottom of a lesson: the lesson's picture, how far through it you are, and a way back to the list. */
export const LessonDock: React.FC<{
  thumbnail?: string;
  fallbackType: React.ComponentProps<typeof CardThumbnail>['fallbackType'];
  stepNumber: number;
  totalSteps: number;
  percentComplete: number;
  onBackToLessons: () => void;
}> = ({ thumbnail, fallbackType, stepNumber, totalSteps, percentComplete, onBackToLessons }) => (
  <div className="sticky bottom-0 left-0 right-0 z-20 px-4 py-2 bg-[#061014]/95 backdrop-blur-md border-t border-teal-500/15 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg overflow-hidden border border-teal-500/20 shrink-0">
        <CardThumbnail src={thumbnail} fallbackType={fallbackType} />
      </div>

      {/* How far through the lesson, to scale. */}
      <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
        <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${percentComplete}%` }} />
      </div>
    </div>

    <div className="flex items-center gap-1">
      <span className="text-xs font-mono font-bold text-slate-300">{stepNumber} / {totalSteps}</span>
      <button onClick={onBackToLessons} className="-mr-2 flex h-11 w-11 items-center justify-center text-slate-400 hover:text-white" aria-label="Back to lessons">
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  </div>
);
