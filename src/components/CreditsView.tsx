import React from 'react';
import { ExternalLink, Scale } from 'lucide-react';
import sources from '../../web/thumbnails/sources.json';
import attribution from '../../web/lesson-media/attribution.json';
import acknowledgements from '../../web/lesson-media/handbook-acknowledgements.json';
import { buildCredits, type AcknowledgementsFile, type AttributionFile, type SourcesFile } from '../data/credits';
import { navigate } from '../routes/useRoute';
import { BackLink } from './ui';

// Generated from the files that record each picture's source, so adding a picture and its record is enough to credit it.
const credits = buildCredits(sources as SourcesFile, attribution as AttributionFile, acknowledgements as AcknowledgementsFile);

const goBack = () => {
  if (history.length > 1) history.back();
  else navigate({ view: 'learn' }, { replace: true });
};

/** Who made the pictures in the app and under what licence. Reached from the About dialog and the foot of the course list. */
export const CreditsView: React.FC = () => (
  <div className="relative h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-4 pt-3">
      <div><BackLink label="Back" ariaLabel="Back" onClick={goBack} /></div>

      <section>
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-teal-300"><Scale className="h-4 w-4 text-teal-400" aria-hidden="true" />Credits</div>
        <h2 className="mt-1 text-2xl font-bold text-white">Pictures and licences</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          Photographs and figures used in lessons and on cards, with the people who made them and the licence each is shared under.
          {credits.ownRenderCount > 0 && <> The other {credits.ownRenderCount} pictures are renders of this app&rsquo;s own 3D models and are course material.</>}
        </p>
      </section>

      {credits.groups.map((group) => (
        <section key={group.license} aria-labelledby={`licence-${group.license.replace(/\W+/g, '-')}`} className="rounded-2xl border border-white/5 bg-[#09181e]/90 p-3.5 shadow-md">
          <h3 id={`licence-${group.license.replace(/\W+/g, '-')}`} className="text-sm font-bold text-white">{group.license}</h3>
          {group.licenseLink && <p className="mt-0.5 text-[11px]"><a href={group.licenseLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-teal-300 hover:text-teal-200">Licence terms<ExternalLink className="h-3 w-3" aria-hidden="true" /></a></p>}
          <ul className="mt-2 flex flex-col divide-y divide-white/5">
            {group.entries.map((entry) => (
              <li key={`${entry.label}|${entry.link || entry.reference || ''}`} className="py-2 first:pt-0 last:pb-0">
                <div className="text-xs font-semibold leading-snug text-slate-100">{entry.label}</div>
                {entry.creator && <div className="mt-0.5 text-[11px] text-slate-400">by {entry.creator}</div>}
                {entry.reference && <div className="mt-0.5 text-[11px] text-slate-400">{entry.reference}</div>}
                {entry.link && <a href={entry.link} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-teal-300 hover:text-teal-200">View the original<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>}
              </li>
            ))}
          </ul>
          {group.notes.map((note) => (
            <details key={note.work} className="mt-3 rounded-xl border border-white/5 bg-slate-900/50 px-3 text-xs text-slate-300">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-teal-300">Who else is thanked in the handbook ({note.contributors.length})</summary>
              <p className="pb-2 leading-relaxed">{note.work}, page {note.page}, chapter{note.chapters.length === 1 ? '' : 's'} {note.chapters.join(', ')}. {note.text}</p>
              <ul className="flex flex-col gap-1 pb-3">
                {note.contributors.map((person) => <li key={person.name}>{person.name}{person.site && <span className="text-slate-400"> · {person.site}</span>}</li>)}
              </ul>
            </details>
          ))}
        </section>
      ))}
    </div>
  </div>
);
