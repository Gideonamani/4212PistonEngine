import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Lesson } from '../../types/engine';
import { outcomeSections, outcomeTexts } from '../../data/outcomes.mjs';

/**
 * What a lesson begins with, on its first step: the one sentence it is for, and the list of what the learner will be able to do by the end,
 * folded away until asked for (the way a chapter opens with its learning objectives). The same outcomes come back at the end of the lesson
 * as the "Check yourself" tick-list. A lesson with no purpose written shows nothing.
 */
export const LessonOpener: React.FC<{ lesson: Lesson }> = ({ lesson }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!lesson.purpose) return null;
  const count = outcomeTexts(lesson.outcomes).length;

  return (
    <section aria-label="About this lesson" className="rounded-xl border border-teal-500/25 bg-inset px-3.5 pb-1 pt-3">
      <p className="font-mono text-[11px] font-bold tracking-widest text-teal-400">THIS LESSON</p>
      <p className="lesson-prose-sm mt-1 font-semibold text-slate-100">{lesson.purpose}</p>

      {count > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="-mx-1.5 mt-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-1.5 text-left text-xs font-semibold text-teal-300 transition-colors hover:text-teal-200"
          >
            <span>What you will be able to do <span className="font-mono text-[11px] text-slate-400">({count})</span></span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          <div id={listId} hidden={!open} className="pb-2">
            {lesson.coreIdea && <p className="lesson-prose-sm mb-2 rounded-lg border border-teal-500/30 bg-teal-950/30 px-3 py-2 font-semibold text-teal-100"><span className="block font-mono text-[11px] font-bold tracking-wider text-teal-300">CORE IDEA</span>{lesson.coreIdea}</p>}
            <p className="lesson-prose-sm text-slate-400">By the end of this lesson you should be able to:</p>
            {outcomeSections(lesson.outcomes).map((section, index) => (
              <div key={section.heading ?? index} className="mt-1.5">
                {section.heading && <p className="lesson-prose-sm font-bold text-white">{section.heading}</p>}
                {section.note && <p className="lesson-prose-sm text-slate-400">{section.note}</p>}
                <ul className="mt-1 flex flex-col gap-1.5 pl-1">
                  {section.items.map((item) => (
                    <li key={item} className="lesson-prose-sm flex gap-2 text-slate-200"><span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
      {count === 0 && <div className="pb-2" />}
    </section>
  );
};
