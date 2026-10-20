import React, { useState } from 'react';
import { Box, ChevronDown, RotateCcw, X } from 'lucide-react';
import { getGenericPartInfo } from '../data/genericPartInfo';
import { STATUS_LABELS, type Claim, type LearnerPart } from '../data/learnerPartDetails';

export type PartCardProps = {
  partId: string;
  defaultLabel?: string;
  defaultFunction?: string;
  /** Learner-facing details for the part (the GTSIO-520-H whole engine and the operating cylinder). Without them the card shows the general fallback. */
  learner?: LearnerPart;
  onClose: () => void;
  onIsolatePart?: (id: string) => void;
  isIsolated?: boolean;
  onUnisolate?: () => void;
  className?: string;
};

/** The evidence behind each line of a part's text, shown on request: nothing a learner reads is unsourced. */
function ClaimSources({ learner }: { learner: LearnerPart }) {
  const rows: [string, Claim | LearnerPart['worksWith']][] = [
    ['Name', learner.titleClaim],
    ['What it does', learner.function],
    ['Made of', learner.madeOf],
    ['Where it sits', learner.sits],
    ['Works with', learner.worksWith],
    ['Look for', learner.lookFor],
  ];
  return (
    <details className="group rounded-lg border border-white/10 bg-slate-950/40">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-2 text-[11px] font-semibold text-teal-300 outline-none hover:text-teal-200 focus-visible:ring-2 focus-visible:ring-teal-300">
        <span>Where this text comes from</span>
        <ChevronDown className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ul className="space-y-1.5 border-t border-white/10 px-2 py-1.5 text-[10.5px] leading-snug text-slate-300">
        {rows.map(([name, claim]) => (
          <li key={name}>
            <span className="font-semibold text-slate-200">{name}</span>
            <span className="ml-1.5 rounded bg-slate-800 px-1 py-px text-[9.5px] font-semibold uppercase tracking-wide text-slate-300">{STATUS_LABELS[claim.status]}</span>
            <span className="mt-0.5 block text-slate-400">{claim.source ?? claim.basis}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function LearnerDetails({ learner }: { learner: LearnerPart }) {
  const lessons = learner.lessons.slice(0, 3);
  return (
    <div className="space-y-2 text-[11px] sm:text-[11.5px] leading-snug text-slate-200">
      <dl className="grid grid-cols-[72px_1fr] sm:grid-cols-[84px_1fr] gap-x-2 gap-y-1.5">
        <dt className="font-semibold text-slate-400">Made of</dt>
        <dd>{learner.madeOf.text}</dd>

        <dt className="font-semibold text-slate-400">Where it sits</dt>
        <dd>{learner.sits.text}</dd>

        <dt className="font-semibold text-slate-400">System</dt>
        <dd>{learner.system.label}</dd>

        {lessons.length > 0 && (
          <>
            <dt className="font-semibold text-slate-400">In lessons</dt>
            <dd>
              <ul className="space-y-0.5">
                {lessons.map((item) => <li key={item.lesson}>Lesson {item.lesson}, {item.title}</li>)}
              </ul>
            </dd>
          </>
        )}
      </dl>

      <div className="border-t border-white/5 pt-1.5">
        <span className="mb-1 block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Works with</span>
        <ul aria-label="Works with" className="flex flex-wrap gap-1">
          {learner.worksWith.titles.map((title) => (
            <li key={title} className="rounded border border-white/10 bg-slate-950/60 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-300">{title}</li>
          ))}
        </ul>
      </div>

      <p className="rounded-lg border border-teal-400/25 bg-teal-400/5 px-2 py-1.5 text-teal-100">
        <span className="font-bold">Look for: </span>
        {learner.lookFor.text}
      </p>

      {learner.catalogue && (
        <div className="border-t border-white/5 pt-1.5 text-[10.5px] text-slate-300">
          <span className="font-semibold text-slate-400">Parts catalogue: </span>
          {learner.catalogue.description}
          <span className="mt-0.5 block text-slate-400">{learner.catalogue.note}</span>
        </div>
      )}

      <ClaimSources learner={learner} />
    </div>
  );
}

export function PartCard({
  partId,
  defaultLabel,
  defaultFunction,
  learner,
  onClose,
  onIsolatePart,
  isIsolated = false,
  onUnisolate,
  className = '',
}: PartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const data = getGenericPartInfo(partId, defaultLabel, defaultFunction);
  const label = learner?.label ?? data.label;
  const functionText = learner?.function.text ?? data.function;

  return (
    <aside
      aria-label={`Component information for ${label}`}
      className={`pointer-events-auto rounded-xl sm:rounded-2xl border border-teal-400/35 bg-panel/95 shadow-2xl backdrop-blur-md transition-all duration-200 text-slate-100 p-2 sm:p-3.5 space-y-1.5 sm:space-y-2.5 ${className}`}
    >
      {/* Row 1: Title and X to close */}
      <div className="flex items-center justify-between gap-1.5">
        <h3 className="min-w-0 break-words text-xs sm:text-sm font-bold tracking-tight text-white leading-tight">
          {label}
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

      {learner && learner.review !== 'reviewed' && (
        <p
          className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
          title="This wording is a draft and has not yet been checked by the instructor."
        >
          Draft text
        </p>
      )}

      {/* Row 2: Function short description (visible on desktop/tablet, hidden on thin screens) */}
      <div className="hidden sm:block text-xs leading-relaxed text-slate-300">
        <p>{functionText}</p>
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
            <p>{functionText}</p>
          </div>

          {learner ? (
            <LearnerDetails learner={learner} />
          ) : (
            <>
              <dl className="grid grid-cols-[65px_1fr] sm:grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-[10.5px] sm:text-[11.5px] leading-snug">
                <dt className="font-semibold text-slate-400">Material</dt>
                <dd className="font-mono text-slate-200">{data.material}</dd>

                <dt className="font-semibold text-slate-400">System</dt>
                <dd className="font-mono text-slate-200">{data.system}</dd>
              </dl>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
