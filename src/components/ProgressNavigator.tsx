import React, { useEffect, useId, useRef, useState } from 'react';
import { Box, Check, ChevronDown, X } from 'lucide-react';
import { CardThumbnail } from './CardThumbnail';
import { IconButton } from './ui';

/**
 * Where you are in a sequence, and a way to jump: a sheet listing every item by number and title. Check questions open it from a
 * progress bar at the top of the screen (ProgressNavigator); a lesson opens it from the footer docked at the bottom (ProgressSheet on
 * its own). Either way the learner sees what is done, where they are, and what remains.
 */

/** done: passed or seen; correct and wrong: a Check answer that has been revealed; todo: not reached yet. */
export type ProgressState = 'done' | 'todo' | 'correct' | 'wrong';
/** `hasModel` marks a lesson step that has a 3D model, with a small cube. */
export type ProgressItem = { id: string; title: string; state: ProgressState; hasModel?: boolean };

/** The lesson a step list belongs to: it heads the sheet with its picture and name, above a full bar and the summary line. */
export type ProgressIdentity = { thumbnail?: string; eyebrow: string; title: string; summary: React.ReactNode };

type ProgressSheetProps = {
  /** What the items are called, singular and lower case: "step" or "question". Used in the accessible names. */
  noun: string;
  /** The title of the sheet, for example "Steps in this lesson". */
  heading: string;
  items: ProgressItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  /** Called when the sheet should go away, after a choice too. The caller puts focus back where it came from. */
  onClose: () => void;
  identity?: ProgressIdentity;
  /** The dialog's id, when a trigger needs it for aria-controls. */
  id?: string;
};

type ProgressNavigatorProps = Omit<ProgressSheetProps, 'onClose' | 'identity' | 'id'> & {
  /** The text row above the bar, for example "Step 3 of 11" on the left and "27% complete" on the right. */
  summary: React.ReactNode;
};

const segmentColour: Record<ProgressState, string> = { done: 'bg-teal-500', todo: 'bg-slate-800', correct: 'bg-teal-400', wrong: 'bg-rose-500' };
const badgeColour: Record<ProgressState, string> = {
  done: 'bg-teal-400 text-slate-950',
  todo: 'border border-slate-600 text-slate-300',
  correct: 'bg-teal-400 text-slate-950',
  wrong: 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/60',
};
const stateWords: Record<ProgressState, string> = { done: 'done', todo: 'not reached yet', correct: 'answered correctly', wrong: 'answered incorrectly' };

/** The segmented bar: one segment per item, filled by state, the current one ringed. */
const SegmentBar: React.FC<{ items: ProgressItem[]; currentIndex: number }> = ({ items, currentIndex }) => (
  <span className="flex gap-0.5" aria-hidden="true">
    {items.map((item, index) => (
      <span
        key={item.id}
        className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors ${index === currentIndex && item.state === 'todo' ? 'bg-teal-300' : segmentColour[item.state]} ${index === currentIndex ? 'ring-1 ring-slate-200/80' : ''}`}
      />
    ))}
  </span>
);

export const ProgressSheet: React.FC<ProgressSheetProps> = ({ noun, heading, items, currentIndex, onSelect, onClose, identity, id }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const ownId = useId();
  const dialogId = id ?? ownId;
  const headingId = useId();

  // On open, move focus to the current item and scroll it into view, so a long list opens where the learner is.
  useEffect(() => {
    currentRef.current?.focus();
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Stop here, so a full-screen lesson behind the sheet does not also hear Escape and close.
      event.stopPropagation();
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const choose = (index: number) => {
    onClose();
    onSelect(index);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
        className="flex max-h-[75dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-teal-500/30 bg-panel text-slate-200 shadow-2xl"
      >
        {identity ? (
          <div className="border-b border-slate-800 pb-3 pl-4 pr-1 pt-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10"><CardThumbnail src={identity.thumbnail} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-teal-300">{identity.eyebrow}</p>
                <h2 id={headingId} className="sr-only">{heading}</h2>
                <p className="truncate text-base font-bold text-white">{identity.title}</p>
              </div>
              <IconButton size="sm" label="Close the list" onClick={onClose}><ChevronDown className="h-4 w-4" /></IconButton>
            </div>
            <div className="mt-3 pr-3">
              <SegmentBar items={items} currentIndex={currentIndex} />
              <p className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-400">{identity.summary}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 py-1 pl-4 pr-1">
            <h2 id={headingId} className="text-sm font-bold text-white">{heading}</h2>
            <IconButton size="sm" label="Close the list" onClick={onClose}><X className="h-4 w-4" /></IconButton>
          </div>
        )}
        <ol className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((item, index) => {
            const current = index === currentIndex;
            return (
              <li key={item.id}>
                <button
                  ref={current ? currentRef : undefined}
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  onClick={() => choose(index)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${current ? 'border-teal-400/50 bg-teal-400/10' : 'border-transparent hover:bg-slate-800/60'}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${current ? 'bg-teal-400/10 text-teal-100 ring-2 ring-teal-300' : badgeColour[item.state]}`} aria-hidden="true">
                    {!current && (item.state === 'done' || item.state === 'correct') ? <Check className="h-4 w-4 stroke-[3]" /> : !current && item.state === 'wrong' ? <X className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-100">
                    <span className="sr-only">{noun} {index + 1}: </span>
                    <span className="line-clamp-2 leading-snug">{item.title}</span>
                    <span className="sr-only">, {stateWords[item.state]}{item.hasModel ? ', has a 3D model' : ''}{current ? ', you are here' : ''}</span>
                  </span>
                  {item.hasModel && <Box className="h-3.5 w-3.5 shrink-0 text-teal-300" aria-hidden="true" />}
                  {current && <span className="shrink-0 font-mono text-[11px] font-bold text-teal-300" aria-hidden="true">NOW</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};

/** A progress bar that spans the available width; tapping the whole summary-and-bar strip opens the sheet. Check uses it. */
export const ProgressNavigator: React.FC<ProgressNavigatorProps> = ({ noun, heading, items, currentIndex, onSelect, summary }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
        className="group -mx-1.5 block min-h-11 w-[calc(100%+0.75rem)] rounded-xl px-1.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <span className="flex items-center justify-between gap-3 text-xs font-medium text-slate-400">
          {summary}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-teal-300" aria-hidden="true" />
        </span>
        <span className="mt-2 block"><SegmentBar items={items} currentIndex={currentIndex} /></span>
        <span className="sr-only">. Open the list of {noun}s to jump to one.</span>
      </button>

      {open && <ProgressSheet id={dialogId} noun={noun} heading={heading} items={items} currentIndex={currentIndex} onSelect={onSelect} onClose={close} />}
    </>
  );
};
