import React from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
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

/** The "‹ Back to …" link at the top of a screen. */
export const BackLink: React.FC<{ label: string; ariaLabel: string; onClick: () => void }> = ({ label, ariaLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-800/60 transition-colors"
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
export const CardImage: React.FC<{ src?: string; fallbackType: React.ComponentProps<typeof CardThumbnail>['fallbackType']; size?: keyof typeof imageSize }> = ({ src, fallbackType, size = 'md' }) => (
  <div className={`${imageSize[size]} rounded-xl overflow-hidden border border-white/10 shrink-0 relative`}>
    <CardThumbnail src={src} fallbackType={fallbackType} />
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
 */
export const CardRow: React.FC<{ onClick: () => void; image: React.ReactNode; imageSide?: 'start' | 'end'; align?: 'start' | 'center'; children: React.ReactNode }> = ({ onClick, image, imageSide = 'start', align = 'center', children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group w-full p-3.5 rounded-2xl bg-[#09181e]/90 border border-white/5 hover:border-teal-500/40 shadow-md cursor-pointer text-left transition-all hover:scale-[1.005] active:scale-[0.99] flex ${align === 'start' ? 'items-start' : 'items-center'} justify-between gap-3`}
  >
    {imageSide === 'start' && image}
    <div className="flex-1 min-w-0">{children}</div>
    {imageSide === 'end' ? <div className="flex items-center gap-2 shrink-0">{image}<RowChevron /></div> : <RowChevron />}
  </button>
);
