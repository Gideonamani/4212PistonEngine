import React, { useState } from 'react';
import { Box, Check, ChevronDown, Plus, RotateCcw, X } from 'lucide-react';
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
  isInFocusGroup?: boolean;
  onToggleFocusGroup?: (id: string) => void;
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
  isInFocusGroup = false,
  onToggleFocusGroup,
  className = '',
}: PartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const data = getComponentMetadata(partId, defaultLabel, defaultFunction);

  return (
    <aside
      aria-label={`Component information for ${data.label}`}
      className={`pointer-events-auto rounded-2xl border border-teal-400/35 bg-panel/95 shadow-2xl backdrop-blur-md transition-all duration-200 text-slate-100 ${className}`}
    >
      {/* Mobile grab indicator */}
      <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-slate-600 sm:hidden" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-3.5 pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold tracking-tight text-white sm:text-[15px]">{data.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close component details"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary function */}
      <div className="px-3.5 pb-2 text-xs leading-relaxed text-slate-300">
        <p>{data.function}</p>
      </div>

      {/* Expand / Collapse trigger */}
      <div className="px-3.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-h-8 w-full items-center justify-between border-t border-white/10 py-1 text-xs font-semibold text-teal-300 outline-none hover:text-teal-200 focus-visible:ring-2 focus-visible:ring-teal-300"
          aria-expanded={expanded}
        >
          <span>{expanded ? 'Less details' : 'More details'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded detailed specifications */}
      {expanded && (
        <div className="space-y-2.5 px-3.5 pb-3 pt-1 border-t border-white/5 text-xs">
          <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1.5 text-[11.5px] leading-snug">
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
          </dl>

          {data.connectedParts && data.connectedParts.length > 0 && (
            <div className="pt-1.5 border-t border-white/5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Connected components
              </span>
              <div className="flex flex-wrap gap-1">
                {data.connectedParts.map((conn) => (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => onSelectPart?.(conn.id)}
                    className="inline-flex items-center rounded-md border border-white/10 bg-slate-950/60 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:border-teal-400/40 hover:text-teal-200 focus-visible:ring-1 focus-visible:ring-teal-300"
                  >
                    {conn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 p-3.5 pt-2 border-t border-white/10">
        {onIsolatePart && (
          <button
            type="button"
            onClick={() => {
              if (isIsolated && onUnisolate) onUnisolate();
              else onIsolatePart(partId);
            }}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
              isIsolated
                ? 'border border-teal-400/50 bg-teal-400/20 text-teal-200 hover:bg-teal-400/30'
                : 'bg-teal-400 text-slate-950 hover:bg-teal-300'
            }`}
          >
            {isIsolated ? <RotateCcw className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
            {isIsolated ? 'Unisolate' : 'Isolate'}
          </button>
        )}

        {onToggleFocusGroup && (
          <button
            type="button"
            onClick={() => onToggleFocusGroup(partId)}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
              isInFocusGroup
                ? 'border-teal-400/50 bg-teal-400/20 text-teal-200'
                : 'border-white/10 bg-slate-900/60 text-slate-200 hover:bg-white/10'
            }`}
          >
            {isInFocusGroup ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : <Plus className="h-3.5 w-3.5" />}
            {isInFocusGroup ? 'In focus' : 'Add to focus'}
          </button>
        )}
      </div>
    </aside>
  );
}
