import React, { useId, useState } from 'react';
import { Check } from 'lucide-react';
import type { Lesson } from '../../types/engine';
import { getLessonProgress, saveOutcomeChecks } from '../../data/lessonProgress';
import { outcomeKey, outcomeSections, outcomeTexts } from '../../data/outcomes.mjs';

/**
 * "Check yourself" at the end of a lesson: what the instructor wrote the lesson for, and what a learner should now be able to do, as a
 * tick-list the learner answers honestly. Ticks are kept on this device only, per sentence, so rewording an outcome starts it unticked.
 * A lesson with no outcomes written shows nothing.
 */
export const SelfCheck: React.FC<{ lesson: Lesson }> = ({ lesson }) => {
  const headingId = useId();
  const sections = outcomeSections(lesson.outcomes);
  const keys = outcomeTexts(lesson.outcomes).map(outcomeKey);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(getLessonProgress(lesson.id).outcomesChecked ?? []));
  if (!keys.length) return null;

  const count = keys.filter((key) => ticked.has(key)).length;
  const toggle = (key: string) => {
    const next = new Set(ticked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setTicked(next);
    saveOutcomeChecks(lesson.id, keys.filter((candidate) => next.has(candidate))); // only ticks for sentences still in the lesson are kept
  };

  const row = (text: string) => {
    const key = outcomeKey(text);
    return (
      <li key={key}>
        <label className="relative flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5">
          {/* The real checkbox covers the whole row, so the whole row is the touch target and it keeps native keyboard and screen-reader behaviour. */}
          <input type="checkbox" checked={ticked.has(key)} onChange={() => toggle(key)} className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-500 text-slate-950 peer-checked:border-teal-400 peer-checked:bg-teal-400 peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-300">
            <Check className="h-3.5 w-3.5 stroke-[3] opacity-0" />
          </span>
          <span className="lesson-prose-sm text-slate-200">{text}</span>
        </label>
      </li>
    );
  };

  return (
    <section aria-labelledby={headingId} className="mt-5 rounded-2xl border border-teal-500/30 bg-inset p-4">
      <p className="font-mono text-[11px] font-bold tracking-[0.2em] text-teal-400">SELF-CHECK</p>
      <h2 id={headingId} className="mt-1 text-base font-bold text-white">Check yourself</h2>
      <p className="lesson-prose-sm mt-1 text-slate-300">Tick what you could do now without looking back at the lesson. Be honest: whatever stays unticked is what to revisit.</p>

      {lesson.purpose && <p className="lesson-prose-sm mt-3 text-slate-300"><span className="font-mono text-[11px] font-bold tracking-wider text-teal-400">THIS LESSON WAS FOR </span>{lesson.purpose}</p>}
      {lesson.coreIdea && <p className="lesson-prose-sm mt-3 rounded-xl border border-teal-500/30 bg-teal-950/30 px-3 py-2 font-semibold text-teal-100"><span className="block font-mono text-[11px] font-bold tracking-wider text-teal-300">CORE IDEA</span>{lesson.coreIdea}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {sections.map((section, index) => section.heading ? (
          <fieldset key={section.heading} className="min-w-0">
            <legend className="px-2 text-sm font-bold text-white">{section.heading}</legend>
            {section.note && <p className="lesson-prose-sm px-2 text-slate-400">{section.note}</p>}
            <ul className="mt-1">{section.items.map(row)}</ul>
          </fieldset>
        ) : <ul key={index}>{section.items.map(row)}</ul>)}
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between gap-3 font-mono text-[11px] font-semibold text-teal-300" aria-live="polite">
          <span>{count} of {keys.length} ticked</span>
          <span className="text-slate-400">{count === keys.length ? 'All ticked: the quiz is a good next step.' : count > 0 ? 'Revisit what is unticked.' : ''}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true"><div className="h-full rounded-full bg-teal-400 transition-[width]" style={{ width: `${(count / keys.length) * 100}%` }} /></div>
      </div>
    </section>
  );
};
