import React from 'react';
import type { ViewMode } from '../../types/engine';
import { VIEW_TABS } from './tabs';

type TabsProps = { activeView: ViewMode; onViewChange: (view: ViewMode) => void };

/** The pill of three modes in the header (hidden below the md breakpoint, where the bottom bar takes over). */
export const HeaderTabs: React.FC<TabsProps> = ({ activeView, onViewChange }) => (
  <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-teal-500/20">
    {VIEW_TABS.map(({ view, icon: Icon, longLabel }) => (
      <button
        key={view}
        onClick={() => onViewChange(view)}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
          activeView === view
            ? 'bg-teal-500 text-slate-950 font-bold shadow-xs shadow-teal-500/50'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span>{longLabel}</span>
      </button>
    ))}
  </nav>
);

/** The bottom bar of three modes, for screens narrower than the md breakpoint. */
export const BottomTabs: React.FC<TabsProps> = ({ activeView, onViewChange }) => (
  <nav className="md:hidden relative z-40 bg-[#061014]/95 backdrop-blur-md border-t border-teal-500/20 py-2 px-6 shrink-0">
    <div className="grid grid-cols-3 items-center">
      {VIEW_TABS.map(({ view, icon: Icon, shortLabel }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className={`flex flex-col items-center gap-1 py-1 transition-colors ${activeView === view ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <Icon className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[11px] font-medium tracking-tight">{shortLabel}</span>
        </button>
      ))}
    </div>
  </nav>
);
