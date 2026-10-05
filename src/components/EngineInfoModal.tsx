import React, { useEffect } from 'react';
import { BookOpen, Box, Info, ShieldCheck, X } from 'lucide-react';

interface EngineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCredits: () => void;
}

export const EngineInfoModal: React.FC<EngineInfoModalProps> = ({ isOpen, onClose, onOpenCredits }) => {
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="course-info-title" className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-teal-500/30 bg-[#091920] p-6 text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase text-teal-400"><Info className="h-4 w-4" />Course and model scope</div><h2 id="course-info-title" className="mt-1 text-xl font-bold text-white">Piston Engine Fundamentals</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">A teaching environment for the GTSIO-520-H operating-cylinder study and the developing full-engine assembly.</p></div><button autoFocus onClick={onClose} className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white" aria-label="Close course information"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3"><Box className="mb-2 h-5 w-5 text-teal-400" /><strong className="block text-white">Explore</strong><p className="mt-1 leading-relaxed text-slate-300">Inspect the published 3D models, select catalogued parts, use section/isolation tools, and operate the validated mechanism profile.</p></div>
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3"><BookOpen className="mb-2 h-5 w-5 text-teal-400" /><strong className="block text-white">Learn and Check</strong><p className="mt-1 leading-relaxed text-slate-300">Lessons, prompts, ordering tasks and answer rationales load from the repository’s validated curriculum packs.</p></div>
      </div>
      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3.5 text-xs leading-relaxed text-amber-100"><div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300"><ShieldCheck className="h-4 w-4" />Evidence boundary</div>Teaching colours, flow cues and idealised cycle timing are labelled demonstrations. The site does not present them as measured temperature, pressure, stress, clearance or performance data. Reference-model limitations are retained in each lesson’s evidence note.</div>
      <button onClick={onOpenCredits} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-900/60 py-2.5 text-xs font-semibold text-teal-300 hover:text-teal-200">Picture credits and licences</button>
      <button onClick={onClose} className="w-full rounded-xl bg-teal-400 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300">Close</button>
    </section>
  </div>;
};
