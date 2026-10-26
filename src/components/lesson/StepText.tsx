import React from 'react';
import { textSegments } from '../../../web/schema/part-links.mjs';
import { toParagraphs } from './paragraphs.mjs';

type StepTextProps = {
  text?: string;
  /** Whether linked words can be tapped: only while the step's part chips are on show (see PartPick). Otherwise they read as plain text. */
  linkable: boolean;
  /** The part chosen to look at alone, if any. */
  selected?: string;
  onChoose: (id: string) => void;
};

/**
 * A step's text, as short paragraphs (see paragraphs.mjs), with the words the author linked to a part, "[intake valve](IntakeValve)", as
 * buttons that spotlight that part alone, exactly as its chip does. A word is a real button so it is reached by keyboard and announced as a
 * control; it keeps the line's height, and a wider invisible area round it makes it easier to hit with a finger.
 */
export function StepText({ text, linkable, selected, onChoose }: StepTextProps) {
  return <div className="lesson-prose flex flex-col gap-[0.85em] text-slate-200">
    {toParagraphs(text).map((paragraph, index) => <p key={index}>
      {textSegments(paragraph).map((segment, at) => {
        if (!segment.part || !linkable) return <React.Fragment key={at}>{segment.text}</React.Fragment>;
        const active = segment.part === selected;
        return <button
          key={at}
          type="button"
          data-inline-target=""
          aria-pressed={active}
          onClick={() => onChoose(segment.part!)}
          className={`relative rounded px-0.5 -mx-0.5 font-semibold underline underline-offset-4 outline-none after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-teal-300 ${active ? 'bg-teal-400/20 text-teal-100 decoration-teal-300' : 'text-teal-200 decoration-teal-400/60 decoration-dotted'}`}
        >{segment.text}</button>;
      })}
    </p>)}
  </div>;
}
