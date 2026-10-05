import React from 'react';

/** The small piston-and-cylinder badge at the left of the app header. */
export const BrandMark: React.FC = () => (
  <div className="w-9 h-9 rounded-xl bg-teal-950/80 border border-teal-400/60 flex items-center justify-center shadow-sm shadow-teal-500/30 shrink-0">
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-300 stroke-current" fill="none" strokeWidth="1.8">
      <rect x="6" y="3" width="12" height="8" rx="1.5" />
      <line x1="6" y1="6" x2="18" y2="6" />
      <line x1="6" y1="8" x2="18" y2="8" />
      <path d="M12 11 L10 17 L14 17 Z" />
      <circle cx="12" cy="18.5" r="2.5" />
    </svg>
  </div>
);
