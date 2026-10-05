import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** The "which 3D model" dropdown under the app title, shown on the Explore screen only. */
export const ModelPicker: React.FC<{ active: string; models: string[]; onSelect?: (model: string) => void }> = ({ active, models, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="group -mb-[15px] -mt-[13px] flex max-w-full items-center gap-1.5 py-[15px] text-left font-mono text-[11px] font-semibold uppercase leading-tight tracking-wider text-teal-400 transition-colors hover:text-teal-300"
        aria-label="Select 3D Engine Model"
      >
        <span className="text-slate-400">MODEL:</span>
        <span className="truncate text-teal-300 underline decoration-teal-500/40 underline-offset-2">{active}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-teal-400 group-hover:text-teal-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-[#091b22]/98 backdrop-blur-xl border border-teal-500/40 shadow-2xl p-1.5 z-50 flex flex-col gap-1">
            <div className="px-3 py-1.5 text-[11px] font-mono text-teal-400 font-bold uppercase tracking-wider border-b border-teal-500/20">Select 3D Engine Assembly</div>
            {models.map((model) => (
              <button
                key={model}
                onClick={() => {
                  onSelect?.(model);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs text-left font-medium transition-all flex items-center justify-between group ${active === model ? 'bg-teal-500/20 text-teal-200 font-bold border border-teal-400/40 shadow-xs' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <span>{model}</span>
                {active === model && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 shadow-xs shadow-teal-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
