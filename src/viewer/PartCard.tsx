import React, { useState } from 'react';
import { Box, ChevronDown, RotateCcw, X } from 'lucide-react';
import { getComponentMetadata } from '../data/componentMetadata';

export type PartCardProps = {
  partId: string;
  defaultLabel?: string;
  defaultFunction?: string;
  onClose: () => void;
  onSelectPart?: (id: string) => void;
  onIsolatePart?: (id: string) => void;
  isIsolated?: boolean;
  onUnisolate?: () => void;
  className?: string;
};

export function PartCard({
  partId,
  defaultLabel,
  defaultFunction,
  onClose,
  onSelectPart,
  onIsolatePart,
  isIsolated = false,
  onUnisolate,
  className = '',
}: PartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const data = getComponentMetadata(partId, defaultLabel, defaultFunction);

  return (
    <aside
      aria-label={`Component information for ${data.label}`}
      className={`pointer-events-auto rounded-xl sm:rounded-2xl border border-teal-400/35 bg-panel/95 shadow-2xl backdrop-blur-md transition-all duration-200 text-slate-100 p-2 sm:p-3.5 space-y-1.5 sm:space-y-2.5 ${className}`}
    >
      {/* Row 1: Title and X to close */}
      <div className="flex items-center justify-between gap-1.5">
        <h3 className="truncate text-xs sm:text-sm font-bold tracking-tight text-white leading-tight">
          {data.label}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close component details"
          title="Close component details"
          className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

      {/* Row 2: Function short description (visible on desktop/tablet, hidden on thin screens) */}
      <div className="hidden sm:block text-xs leading-relaxed text-slate-300">
        <p>{data.function}</p>
      </div>

      {/* Row 3 on desktop, Row 2 on thin screen: Isolate button & Details Expander */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {onIsolatePart && (
          <button
            type="button"
            onClick={() => {
              if (isIsolated && onUnisolate) onUnisolate();
              else onIsolatePart(partId);
            }}
            className={`flex min-h-7 sm:min-h-8 flex-1 items-center justify-center gap-1 rounded-lg px-2 sm:px-3 text-[11px] sm:text-xs font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
              isIsolated
                ? 'border border-teal-400/50 bg-teal-400/20 text-teal-200 hover:bg-teal-400/30'
                : 'bg-teal-400 text-slate-950 hover:bg-teal-300'
            }`}
          >
            {isIsolated ? <RotateCcw className="h-3 w-3" /> : <Box className="h-3 w-3" />}
            <span>{isIsolated ? 'Unisolate' : 'Isolate'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-h-7 sm:min-h-8 items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-900/60 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold text-teal-300 outline-none hover:bg-white/10 hover:text-teal-200 focus-visible:ring-2 focus-visible:ring-teal-300"
          aria-expanded={expanded}
        >
          <span>{expanded ? 'Less' : 'Details'}</span>
          <ChevronDown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded detailed specifications */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
          {/* On mobile, show function description inside expanded drawer */}
          <div className="sm:hidden text-[11px] leading-snug text-slate-300 pb-1 border-b border-white/5">
            <p>{data.function}</p>
          </div>

          <dl className="grid grid-cols-[65px_1fr] sm:grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-[10.5px] sm:text-[11.5px] leading-snug">
            {data.partNumber && (
              <>
                <dt className="font-semibold text-slate-400">Part No.</dt>
                <dd className="font-mono text-teal-300 font-semibold">{data.partNumber}</dd>
              </>
            )}

            <dt className="font-semibold text-slate-400">Material</dt>
            <dd className="font-mono text-slate-200">{data.material}</dd>

            <dt className="font-semibold text-slate-400">System</dt>
            <dd className="font-mono text-slate-200">{data.system}</dd>

            {data.operatingConditions && (
              <>
                <dt className="font-semibold text-slate-400">Operating</dt>
                <dd className="font-mono text-slate-200">{data.operatingConditions}</dd>
              </>
            )}

            {data.source && (
              <>
                <dt className="font-semibold text-slate-400">Source</dt>
                <dd className="font-mono text-[10px] text-slate-400">{data.source}</dd>
              </>
            )}
          </dl>

          {data.connectedParts && data.connectedParts.length > 0 && (
            <div className="pt-1.5 border-t border-white/5">
              <span className="block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Connected components
              </span>
              <div className="flex flex-wrap gap-1">
                {data.connectedParts.map((conn) => (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => onSelectPart?.(conn.id)}
                    className="inline-flex items-center rounded border border-white/10 bg-slate-950/60 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-300 hover:border-teal-400/40 hover:text-teal-200 focus-visible:ring-1 focus-visible:ring-teal-300"
                  >
                    {conn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
