import React, { useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, FileText, Layers, Sparkles } from 'lucide-react';
import type { CourseTrack } from '../../types/engine';
import { CardThumbnail } from '../CardThumbnail';
import { Chip } from '../ui';

type CourseHeroProps = {
  track: CourseTrack;
  /** Share of the course's lessons completed, 0 to 100. */
  progress: number;
  /** What the main button says ("Start course", "Continue", "Review course") and does. */
  actionLabel: string;
  onAction: () => void;
};

/** The title, with a small "Course" label above it when there is no banner to say so (over a banner the label would only add height to the scrim). */
const CourseTitle: React.FC<{ title: string; onImage: boolean }> = ({ title, onImage }) => (
  <>
    {!onImage && (
      <div className="mb-1 flex items-center gap-1.5 text-teal-300">
        <BookOpen className="h-4 w-4 text-teal-400" aria-hidden="true" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider">Course</span>
      </div>
    )}
    <h3 id="course-title" className={`font-bold leading-tight text-white ${onImage ? 'text-lg [text-shadow:0_1px_8px_rgb(0_0_0/0.7)] sm:text-2xl' : 'text-xl sm:text-2xl'}`}>{title}</h3>
  </>
);

/** The description, three lines at first, with a toggle that appears only when there is more to show. */
const Description: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const element = ref.current;
      if (element && !expanded) setOverflows(element.scrollHeight - element.clientHeight > 1);
    };
    measure();
    // A web font that arrives after first paint can change where the lines break, so measure again once fonts are in.
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded]);

  return (
    <div>
      <p ref={ref} id="course-description" className={`text-xs leading-relaxed text-slate-300 ${expanded ? '' : 'line-clamp-3'}`}>{text}</p>
      {(overflows || expanded) && (
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="course-description" className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-teal-300 hover:text-teal-200">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

/** The top of a course page: the banner with the title on it, the description, a few facts, and the button that starts or resumes the course. */
export const CourseHero: React.FC<CourseHeroProps> = ({ track, progress, actionLabel, onAction }) => (
  <section aria-labelledby="course-title" className="relative overflow-hidden rounded-2xl border border-teal-500/35 bg-gradient-to-br from-[#081a20] via-[#07171d] to-[#040e13] shadow-xl shadow-black/50">
    {track.banner && (
      <div className="relative aspect-[2/1] w-full bg-slate-950">
        <CardThumbnail src={track.banner} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#040e13]/95 via-[#040e13]/55 to-transparent px-4 pb-2.5 pt-10">
          <CourseTitle title={track.title} onImage />
        </div>
      </div>
    )}
    <div className="flex flex-col gap-2 p-4 sm:p-5">
      {!track.banner && <div><CourseTitle title={track.title} onImage={false} /></div>}
      <Description text={track.description} />
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <Chip icon={Layers} size="md">{track.lessonCount} {track.lessonCount === 1 ? 'Lesson' : 'Lessons'}</Chip>
        <Chip icon={FileText} size="md">{track.stepCountApprox}</Chip>
        {progress > 0 && <Chip icon={Sparkles} tone="accent" size="md">{progress}% complete</Chip>}
      </div>
      <button type="button" onClick={onAction} className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-teal-300 active:scale-[0.99]">
        {actionLabel}<ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </section>
);
