import React from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, type LucideIcon } from 'lucide-react';
import type { Lesson } from '../types/engine';
import { CardThumbnail } from './CardThumbnail';

// The small pieces the lists share, so a restyle happens once.

const chipTone = {
  plain: { sm: 'px-2 py-0.5 bg-slate-900/60 border-slate-700/50', md: 'px-2.5 py-1 bg-slate-900/80 border-slate-700/60' },
  accent: { sm: 'px-2 py-0.5 bg-teal-950/40 border-teal-500/30 font-semibold', md: 'px-2.5 py-1 bg-teal-950/50 border-teal-500/30 font-semibold' },
};

/** A small fact label with an icon, for example "4 lessons" or "45 steps". `accent` is for progress. */
export const Chip: React.FC<{ icon?: LucideIcon; tone?: 'plain' | 'accent'; size?: 'sm' | 'md'; children: React.ReactNode }> = ({ icon: Icon, tone = 'plain', size = 'sm', children }) => (
  <div className={`flex items-center gap-1 rounded-md border ${chipTone[tone][size]} ${tone === 'accent' ? 'text-teal-300' : 'text-slate-300'}`}>
    {Icon && <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-teal-400`} />}
    <span>{children}</span>
  </div>
);

/** Shown on a lesson until the instructor has reviewed it (reviewStatus in the lesson pack); renders nothing once it is reviewed. */
export const ReviewChip: React.FC<{ lesson: Pick<Lesson, 'reviewStatus'> }> = ({ lesson }) => lesson.reviewStatus === 'reviewed' ? null : (
  <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-950/30 px-2 py-0.5 font-mono text-[11px] font-semibold normal-case tracking-normal text-amber-300">
    <ClipboardList className="h-3 w-3" aria-hidden="true" />Instructor review pending
  </span>
);

/**
 * A round icon-only button. The touch target is always 44 px (the size phones and our own rule ask for), while the visible circle stays
 * smaller so toolbars keep their look: 'md' is 36 px (viewer tools), 'sm' is 32 px (header tools). Pass `active` for a toggle, which then
 * reports aria-pressed; leave it out for a plain action. `className` positions the 44 px box, for example with a negative margin to
 * keep a tight header from growing.
 */
type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'aria-pressed' | 'type'> & {
  label: string;
  active?: boolean;
  tone?: 'dark' | 'primary';
  size?: 'sm' | 'md';
  shape?: 'round' | 'soft';
};

const circleSize = { sm: 'h-8 w-8', md: 'h-9 w-9' };

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({ label, active, tone = 'dark', size = 'md', shape = 'round', className = '', children, ...rest }, ref) => {
  const look = tone === 'primary'
    ? 'border-transparent bg-teal-400 text-slate-950'
    : active
      ? 'border-teal-300 bg-teal-400/20 text-teal-200'
      : 'border-slate-600/70 bg-[#07161b]/90 text-slate-200 group-hover:border-teal-400';
  return (
    <button ref={ref} type="button" aria-label={label} aria-pressed={active} {...rest} className={`group flex h-11 w-11 shrink-0 items-center justify-center outline-none ${className}`}>
      <span className={`flex ${circleSize[size]} items-center justify-center border shadow-lg transition-colors group-focus-visible:ring-2 group-focus-visible:ring-teal-300 ${shape === 'round' ? 'rounded-full' : 'rounded-xl'} ${look}`}>{children}</span>
    </button>
  );
});
IconButton.displayName = 'IconButton';

/** The "‹ Back to …" link at the top of a screen. */
export const BackLink: React.FC<{ label: string; ariaLabel: string; onClick: () => void }> = ({ label, ariaLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="-my-2 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-teal-400 transition-colors hover:bg-slate-800/60 hover:text-teal-300"
    aria-label={ariaLabel}
  >
    <ChevronLeft className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

const imageSize = {
  md: 'w-20 h-20 sm:w-22 sm:h-22',
  lg: 'w-22 h-22 sm:w-24 sm:h-24',
};

/** A rounded square card image with the standard frame. */
export const CardImage: React.FC<{ src?: string; size?: keyof typeof imageSize }> = ({ src, size = 'md' }) => (
  <div className={`${imageSize[size]} rounded-xl overflow-hidden border border-white/10 shrink-0 relative`}>
    <CardThumbnail src={src} />
  </div>
);

/** The round chevron at the end of a tappable row. Must sit inside an element with the `group` class. */
export const RowChevron: React.FC = () => (
  <span className="w-8 h-8 rounded-full bg-slate-900/80 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-teal-300 group-hover:border-teal-400/40 shrink-0 transition-colors">
    <ChevronRight className="w-4 h-4" />
  </span>
);

/**
 * A tappable list row: a card image beside the text, then a chevron. Put the image on the right (`imageSide="end"`) for the course
 * list, where the text leads. Children go in the text column; use `group-hover:` classes in them to react to the row being hovered.
 * A `footer` takes a line of its own across the whole card, for a note that does not fit the narrow text column.
 */
export const CardRow: React.FC<{ onClick: () => void; image: React.ReactNode; imageSide?: 'start' | 'end'; align?: 'start' | 'center'; footer?: React.ReactNode; children: React.ReactNode }> = ({ onClick, image, imageSide = 'start', align = 'center', footer, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group w-full p-3.5 rounded-2xl bg-[#09181e]/90 border border-white/5 hover:border-teal-500/40 shadow-md cursor-pointer text-left transition-all hover:scale-[1.005] active:scale-[0.99] flex flex-wrap ${align === 'start' ? 'items-start' : 'items-center'} justify-between gap-x-3 gap-y-2`}
  >
    {imageSide === 'start' && image}
    <div className="flex-1 min-w-0">{children}</div>
    {imageSide === 'end' ? <div className="flex items-center gap-2 shrink-0">{image}<RowChevron /></div> : <RowChevron />}
    {footer && <div className="basis-full">{footer}</div>}
  </button>
);
