import React, { useState } from 'react';
import { Award, FileQuestion, ListRestart, PenLine } from 'lucide-react';
import type { Lesson } from '../../types/engine';
import { getLessonProgress, saveLessonReflection } from '../../data/lessonProgress';

const actionClass = 'flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-700 bg-slate-900/55 p-3.5 text-left transition hover:border-teal-400';

/** What the learner sees after the last step: a note of what they finished, an optional reflection, and where to go next. */
export const LessonComplete: React.FC<{ lesson: Lesson; onTakeQuiz?: (lessonId: string) => void; onBackToLessons: () => void }> = ({ lesson, onTakeQuiz, onBackToLessons }) => {
  const [isWritingReflection, setIsWritingReflection] = useState(false);
  const [reflection, setReflection] = useState(() => getLessonProgress(lesson.id).reflection || '');

  return <div className="flex h-full w-full overflow-y-auto bg-[#061014] px-4 py-6 text-slate-100">
    <section className="m-auto w-full max-w-xl rounded-3xl border border-teal-500/35 bg-gradient-to-br from-[#0a2427] via-[#08191e] to-[#050f13] p-5 shadow-2xl sm:p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-400/40 bg-teal-500/15 text-teal-300"><Award className="h-7 w-7" /></div>
      <p className="mt-5 font-mono text-[11px] font-bold tracking-[0.2em] text-teal-400">LESSON COMPLETE</p>
      <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">You completed {lesson.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">Your progress is saved on this device. Reflection and checking your knowledge are optional.</p>

      {isWritingReflection ? <div className="mt-5 rounded-2xl border border-teal-500/30 bg-[#061418] p-4"><label htmlFor="lesson-reflection" className="text-sm font-semibold text-white">What were the three most important things you learned?</label><textarea id="lesson-reflection" rows={6} autoFocus value={reflection} onChange={(event) => { setReflection(event.target.value); saveLessonReflection(lesson.id, event.target.value); }} placeholder="Write your reflection or summary here…" className="mt-3 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm leading-relaxed text-white placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" /><p className="mt-2 text-[11px] text-slate-400">Saved locally as you type.</p></div> : null}

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <button type="button" onClick={() => setIsWritingReflection((value) => !value)} className={actionClass}><PenLine className="h-5 w-5 text-teal-300" /><span className="mt-3 text-xs font-bold text-white">{isWritingReflection ? 'Close reflection' : 'Write a reflection'}</span></button>
        <button type="button" onClick={() => onTakeQuiz?.(lesson.id)} className={actionClass}><FileQuestion className="h-5 w-5 text-teal-300" /><span className="mt-3 text-xs font-bold text-white">Take this lesson’s quiz</span></button>
        <button type="button" onClick={onBackToLessons} className={actionClass}><ListRestart className="h-5 w-5 text-teal-300" /><span className="mt-3 text-xs font-bold text-white">Return to lessons</span></button>
      </div>
    </section>
  </div>;
};
