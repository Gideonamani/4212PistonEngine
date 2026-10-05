import React, { useEffect, useState } from 'react';
import { CourseTrack, Lesson } from '../types/engine';
import { BackLink, CardImage, CardRow, Chip, ReviewChip } from './ui';
import { LessonStepViewer } from './LessonStepViewer';
import { CourseHero } from './learn/CourseHero';
import {
  BookOpen,
  Box,
  FileText,
  Layers,
  CheckCircle,
  Scale,
} from 'lucide-react';
import { getCompletedLessonIds, getLessonProgress, LESSON_PROGRESS_EVENT } from '../data/lessonProgress';
import { resolveLearn } from '../routes/route.mjs';
import { navigate, useRoute } from '../routes/useRoute';

interface LearnViewProps {
  tracks: CourseTrack[];
  onSwitchToExploreModel?: (modelName: string) => void;
  onTakeLessonQuiz?: (lessonId: string) => void;
}

export const LearnView: React.FC<LearnViewProps> = ({ tracks, onSwitchToExploreModel, onTakeLessonQuiz }) => {
  // The address decides the level: #/learn = course menu, #/learn/<course> = its lessons, then a lesson's steps.
  const route = useRoute();
  const { track: activeTrack, lesson: activeLesson } = resolveLearn(tracks, route);
  const learn = route.view === 'learn' ? route : { view: 'learn' as const };
  const [progressVersion, setProgressVersion] = useState(0);
  const completedLessonIds = getCompletedLessonIds();

  useEffect(() => {
    const refreshProgress = () => setProgressVersion((value) => value + 1);
    window.addEventListener(LESSON_PROGRESS_EVENT, refreshProgress);
    window.addEventListener('storage', refreshProgress);
    return () => {
      window.removeEventListener(LESSON_PROGRESS_EVENT, refreshProgress);
      window.removeEventListener('storage', refreshProgress);
    };
  }, []);

  void progressVersion;

  const openCourse = (track: CourseTrack) => navigate({ view: 'learn', course: track.id });

  const openLesson = (lesson: Lesson) => {
    if (activeTrack) navigate({ view: 'learn', course: activeTrack.id, lesson: lesson.id, step: 1 });
  };

  const openDeepDive = (lessonId: string) => {
    const target = activeTrack?.deepDives?.find((lesson) => lesson.id === lessonId);
    if (target) openLesson(target);
  };

  const returnToLessons = () => {
    if (!activeTrack) return;
    navigate({ view: 'learn', course: activeTrack.id });
  };

  const backToCourses = () => navigate({ view: 'learn' });

  // A lesson in step mode.
  if (activeLesson && activeTrack) {
    return (
      <LessonStepViewer
        key={activeLesson.id}
        lesson={activeLesson}
        initialStepIndex={learn.step ? learn.step - 1 : undefined}
        initialComplete={learn.complete}
        onBackToLessons={returnToLessons}
        deepDives={activeTrack.deepDives}
        onOpenDeepDive={openDeepDive}
        onSwitchTo3DModel={(model) => onSwitchToExploreModel?.(model)}
        onTakeQuiz={onTakeLessonQuiz}
        onStepChange={(stepIndex) => navigate({ view: 'learn', course: activeTrack.id, lesson: activeLesson.id, step: stepIndex + 1 }, { replace: true })}
        onComplete={() => navigate({ view: 'learn', course: activeTrack.id, lesson: activeLesson.id, complete: true }, { replace: true })}
      />
    );
  }

  const percentDone = (track: CourseTrack) => Math.round((track.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length / Math.max(track.lessons.length, 1)) * 100);

  // LEVEL 1: course menu.
  if (!activeTrack) {
    return (
      <div className="relative w-full h-full flex flex-col bg-[#061014] text-slate-100 overflow-y-auto select-none pb-24">
        <div className="px-4 pt-4 pb-2 max-w-xl mx-auto w-full">
          <div className="flex items-center gap-1.5 text-teal-300">
            <BookOpen className="w-4 h-4 text-teal-400" />
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase">Learn mode · Guided curriculum</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Courses</h2>
          <p className="text-xs text-slate-400 mt-1">Choose a course, then work through its lessons step by step.</p>
        </div>

        <div className="px-4 py-2 flex flex-col gap-3 max-w-xl mx-auto w-full">
          {tracks.map((track) => {
            const progress = percentDone(track);
            return (
              <CardRow
                key={track.id}
                onClick={() => openCourse(track)}
                align="start"
                imageSide="end"
                image={<CardImage src={track.thumbnail} size="lg" />}
              >
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">{track.title}</h3>
                <p className="text-xs text-slate-300 leading-snug mt-1 line-clamp-2">{track.description}</p>
                <div className="flex items-center flex-wrap gap-2 mt-2.5 text-[11px] font-mono">
                  <Chip icon={Layers}>{track.lessonCount} {track.lessonCount === 1 ? 'lesson' : 'lessons'}</Chip>
                  <Chip icon={FileText}>{track.stepCountApprox}</Chip>
                  {progress > 0 && <Chip icon={CheckCircle} tone="accent">{progress}% complete</Chip>}
                </div>
              </CardRow>
            );
          })}
        </div>

        <div className="px-4 pb-2 max-w-xl mx-auto w-full">
          <button type="button" onClick={() => navigate({ view: 'credits' })} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-400 hover:text-teal-300">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />Picture credits and licences
          </button>
        </div>
      </div>
    );
  }

  // LEVEL 2: the chosen course's lesson list.
  const courseProgress = percentDone(activeTrack);
  // The main button starts the course, resumes the first lesson not yet finished at the step the learner reached, or (all done) reopens it.
  const nextLesson = activeTrack.lessons.find((lesson) => !completedLessonIds.has(lesson.id));
  const started = activeTrack.lessons.some((lesson) => completedLessonIds.has(lesson.id) || Boolean(getLessonProgress(lesson.id).currentStep));
  const action = nextLesson && started
    ? { label: 'Continue', run: () => navigate({ view: 'learn', course: activeTrack.id, lesson: nextLesson.id, step: Math.min((getLessonProgress(nextLesson.id).currentStep ?? 0) + 1, nextLesson.stepCount) }) }
    : { label: nextLesson ? 'Start course' : 'Review course', run: () => activeTrack.lessons[0] && openLesson(activeTrack.lessons[0]) };
  return (
    <div className="relative w-full h-full flex flex-col bg-[#061014] text-slate-100 overflow-y-auto select-none pb-24">
      <div className="px-4 pt-3 pb-2 flex flex-col gap-4 max-w-xl mx-auto w-full">
        <div>
          <BackLink label="All Courses" ariaLabel="Back to courses" onClick={backToCourses} />
        </div>

        <CourseHero track={activeTrack} progress={courseProgress} actionLabel={action.label} onAction={action.run} />

        <div className="flex items-center justify-between pt-1">
          <h3 className="text-base font-bold text-white">Lessons</h3>
          <span className="text-xs font-mono text-slate-400">{activeTrack.lessons.length} lessons</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {activeTrack.lessons.map((lesson) => (
            <CardRow key={lesson.id} onClick={() => openLesson(lesson)} image={<CardImage src={lesson.thumbnail} />} footer={lesson.reviewStatus === 'reviewed' ? undefined : <ReviewChip lesson={lesson} />}>
              <div className="text-[11px] font-mono tracking-wider uppercase text-slate-400 font-semibold">{lesson.lessonNumber}</div>
              <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-teal-300 transition-colors mt-0.5 truncate">{lesson.title}</h4>
              {lesson.hasModelBadge && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md bg-teal-950/40 border border-teal-500/30 text-teal-300 text-[11px] font-medium">
                  <Box className="w-3 h-3" />
                  <span>Has a reference model</span>
                </div>
              )}
              <p className="text-xs text-slate-300 leading-snug mt-1 line-clamp-2">{lesson.subtitle}</p>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mt-2">
                <FileText className="w-3 h-3 text-teal-400" />
                <span>{lesson.stepCount} steps</span>
                {completedLessonIds.has(lesson.id) && <span className="ml-2 inline-flex items-center gap-1 font-sans font-semibold text-emerald-400"><CheckCircle className="h-3.5 w-3.5" />Completed</span>}
              </div>
            </CardRow>
          ))}
        </div>
      </div>
    </div>
  );
};
