import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { LessonStep } from '../../types/engine';

const isWebUrl = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

/** Whether a step has any evidence, scope note or media credit to show; the lesson only offers the Info button when it does. */
export const stepHasEvidence = (step: LessonStep) => Boolean(step.note || step.sourceRefs?.length || step.credit || step.license || step.sourceUrl || isWebUrl(step.url));

const linkClass = 'text-teal-300 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-200';

/**
 * The evidence and scope note of one step, as a modal sheet. It takes focus when it opens and closes on Escape or a tap outside;
 * `onClose` is where the caller puts focus back on whatever opened it.
 */
export const EvidenceDialog: React.FC<{ step: LessonStep; stepNumber: number; onClose: () => void }> = ({ step, stepNumber, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  // The caller's onClose changes every render; hold it in a ref so focus is taken once, when the dialog opens.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section id="lesson-evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-evidence-title" className="max-h-[75dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-teal-500/30 bg-[#09191f] p-4 text-slate-200 shadow-2xl sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[11px] font-bold tracking-widest text-teal-400">STEP {stepNumber}</span><h2 id="lesson-evidence-title" className="mt-1 text-base font-bold text-white">Evidence &amp; scope note</h2></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Close evidence and scope note" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-300"><X className="h-4 w-4" /></button></div>
      {step.note && <p className="mt-4 text-sm leading-relaxed text-slate-300">{step.note}</p>}
      {(step.credit || step.license) && <p className="mt-3 text-xs leading-relaxed text-slate-400"><span className="font-semibold text-slate-300">Media:</span> {[step.credit, step.license].filter(Boolean).join(' · ')}</p>}
      {step.sourceUrl ? <a href={step.sourceUrl} target="_blank" rel="noreferrer" className={`mt-3 inline-flex text-xs font-semibold ${linkClass}`}>Open media source</a> : null}
      {step.sourceRefs?.length ? <div className="mt-4 border-t border-slate-700/70 pt-3"><h3 className="font-mono text-[11px] font-bold tracking-wider text-slate-400">SOURCE REFERENCES</h3><ul className="mt-2 space-y-2 text-xs text-slate-300">{step.sourceRefs.map((reference) => <li key={reference} className="break-words">{isWebUrl(reference) ? <a href={reference} target="_blank" rel="noreferrer" className={linkClass}>{reference}</a> : reference}</li>)}</ul></div> : null}
      {isWebUrl(step.url) ? <a href={step.url} target="_blank" rel="noreferrer" className={`mt-4 inline-flex text-xs font-semibold ${linkClass}`}>Open supporting source</a> : null}
    </section>
  </div>;
};
