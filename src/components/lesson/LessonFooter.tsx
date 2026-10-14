import React from 'react';
import { ChevronUp } from 'lucide-react';
import { CardThumbnail } from '../CardThumbnail';
import { useStoredChoice } from '../../data/localChoice';

/** Which number sits under the step count: how far through you are, or how many steps remain. */
const READOUTS = ['percent', 'left'] as const;
type Readout = (typeof READOUTS)[number];
const READOUT_KEY = '4212-lesson-readout';

type LessonFooterProps = {
  thumbnail?: string;
  /** For example "Lesson 09". */
  lessonNumber: string;
  stepNumber: number;
  totalSteps: number;
  percentComplete: number;
  expanded: boolean;
  onOpenSteps: () => void;
};

/**
 * The footer docked to the bottom of a lesson, in the slot the three mode tabs use elsewhere. Two columns that line up in rows: the
 * lesson and its step count on the top row (white), the progress bar and the percentage on the bottom (teal). Tapping the picture, the
 * lesson name or the bar (or the chevron) opens the list of steps; the count and percentage on the right are a quiet toggle between
 * the percentage and the number of steps left. It holds the learner's place; the way back to the lessons is the link at the top.
 */
export const LessonFooter = React.forwardRef<HTMLButtonElement, LessonFooterProps>(({ thumbnail, lessonNumber, stepNumber, totalSteps, percentComplete, expanded, onOpenSteps }, ref) => {
  const [readout = 'percent', chooseReadout] = useStoredChoice<Readout>(READOUT_KEY, READOUTS);
  const stepsLeft = totalSteps - stepNumber;
  const readoutText = readout === 'percent' ? `${percentComplete}%` : stepsLeft === 0 ? 'last step' : `${stepsLeft} left`;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 flex shrink-0 items-center gap-2 border-t border-teal-500/20 bg-canvas/95 px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={onOpenSteps}
        className="flex h-[54px] min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10"><CardThumbnail src={thumbnail} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="h-[18px] truncate text-[12.5px] font-semibold leading-[18px] text-white">{lessonNumber}</span>
          <span className="flex h-[18px] items-center" aria-hidden="true">
            <span className="block h-1 w-full overflow-hidden rounded-full bg-slate-700"><span className="block h-full rounded-full bg-teal-400 transition-all" style={{ width: `${percentComplete}%` }} /></span>
          </span>
        </span>
        <span className="sr-only">Step {stepNumber} of {totalSteps}. Open the list of steps to jump to one.</span>
      </button>

      <button
        type="button"
        aria-label={`${stepNumber} of ${totalSteps} steps, showing ${readoutText}. Switch between percent and steps left`}
        onClick={() => chooseReadout(readout === 'percent' ? 'left' : 'percent')}
        className="flex h-[54px] min-w-14 shrink-0 flex-col items-end justify-center gap-1 rounded-xl px-1 font-mono text-[13px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <span aria-hidden="true" className="h-[18px] leading-[18px] text-white">{stepNumber}/{totalSteps}</span>
        <span aria-hidden="true" className="h-[18px] leading-[18px] text-teal-300">{readoutText}</span>
      </button>

      {/* The chevron repeats the main button for a finger that goes looking for it; screen readers already have that button. */}
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onOpenSteps} className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:text-white">
        <ChevronUp className="h-5 w-5 stroke-[2.2]" />
      </button>
    </div>
  );
});
LessonFooter.displayName = 'LessonFooter';
