import React, { useEffect, useState } from 'react';
import { CourseTrack, Lesson } from '../types/engine';
import { CardThumbnail } from './CardThumbnail';
import { LessonStepViewer } from './LessonStepViewer';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Box,
  FileText,
  Layers,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { getCompletedLessonIds, LESSON_PROGRESS_EVENT } from '../data/lessonProgress';
import { resolveLearn } from '../routes/route.mjs';
import { navigate, useRoute } from '../routes/useRoute';

interface LearnViewProps {
  tracks: CourseTrack[];
  onSwitchToExploreModel?: (modelName: string) => void;
  onTakeLessonQuiz?: (lessonId: string) => void;
  onLessonImmersiveChange?: (isImmersive: boolean) => void;
}

export const LearnView: React.FC<LearnViewProps> = ({ tracks, onSwitchToExploreModel, onTakeLessonQuiz, onLessonImmersiveChange }) => {
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
    onLessonImmersiveChange?.(false);
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
        onImmersiveChange={onLessonImmersiveChange}
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
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase">Learn mode · Guided curriculum</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Courses</h2>
          <p className="text-xs text-slate-400 mt-1">Choose a course, then work through its lessons step by step.</p>
        </div>

        <div className="px-4 py-2 flex flex-col gap-3 max-w-xl mx-auto w-full">
          {tracks.map((track) => {
            const progress = percentDone(track);
            return (
              <button
                type="button"
                key={track.id}
                onClick={() => openCourse(track)}
                className="p-3.5 rounded-2xl border border-white/5 bg-[#09181e]/90 hover:border-teal-500/40 text-left cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] flex items-start justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">{track.title}</h3>
                  <p className="text-xs text-slate-300 leading-snug mt-1 line-clamp-2">{track.description}</p>
                  <div className="flex items-center flex-wrap gap-2 mt-2.5 text-[11px] font-mono">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/50 text-slate-300">
                      <Layers className="w-3 h-3 text-teal-400" />
                      <span>{track.lessonCount} {track.lessonCount === 1 ? 'lesson' : 'lessons'}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/50 text-slate-300">
                      <FileText className="w-3 h-3 text-teal-400" />
                      <span>{track.stepCountApprox}</span>
                    </div>
                    {progress > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-950/40 border border-teal-500/30 text-teal-300 font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        <span>{progress}% complete</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <CardThumbnail src={track.thumbnail} fallbackType={track.imageType} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-teal-300 group-hover:border-teal-400/40 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // LEVEL 2: the chosen course's lesson list.
  const courseProgress = percentDone(activeTrack);
  return (
    <div className="relative w-full h-full flex flex-col bg-[#061014] text-slate-100 overflow-y-auto select-none pb-24">
      <div className="px-4 pt-3 pb-2 flex flex-col gap-4 max-w-xl mx-auto w-full">
        <div>
          <button
            onClick={backToCourses}
            className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-800/60 transition-colors"
            aria-label="Back to courses"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>All Courses</span>
          </button>
        </div>

        <div
          onClick={() => activeTrack.lessons[0] && openLesson(activeTrack.lessons[0])}
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#081a20] via-[#07171d] to-[#040e13] border border-teal-500/35 shadow-xl shadow-black/50 hover:border-teal-400/60 cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-teal-300">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase">Course</span>
            </div>
            <span className="text-[10px] font-mono text-teal-400/80 group-hover:text-teal-300 flex items-center gap-0.5 font-semibold">
              {courseProgress > 0 ? 'Review lessons' : 'Start course'} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 mt-0.5">
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-teal-300 transition-colors">{activeTrack.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">{activeTrack.description}</p>
              <div className="flex items-center flex-wrap gap-2 mt-3 text-[11px] font-mono">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-700/60 text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  <span>{activeTrack.lessonCount} {activeTrack.lessonCount === 1 ? 'Lesson' : 'Lessons'}</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-700/60 text-slate-300">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>{activeTrack.stepCountApprox}</span>
                </div>
                {courseProgress > 0 && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-950/50 border border-teal-500/30 text-teal-300 font-semibold">
                    <Sparkles className="w-3 h-3 text-teal-400" />
                    <span>{courseProgress}% complete</span>
                  </div>
                )}
              </div>
            </div>
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-teal-500/20 shrink-0 relative bg-slate-950/60">
              <CardThumbnail src={activeTrack.thumbnail} fallbackType={activeTrack.imageType} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <h3 className="text-base font-bold text-white">Lessons</h3>
          <span className="text-xs font-mono text-slate-400">{activeTrack.lessons.length} lessons</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {activeTrack.lessons.map((lesson) => (
            <button
              type="button"
              key={lesson.id}
              onClick={() => openLesson(lesson)}
              className="w-full p-3.5 rounded-2xl bg-[#09181e]/90 border border-white/5 hover:border-teal-500/40 shadow-md cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] flex items-center justify-between gap-3 group text-left"
            >
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden border border-white/10 shrink-0 relative">
                <CardThumbnail src={lesson.thumbnail} fallbackType={lesson.imageType} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold">{lesson.lessonNumber}</div>
                <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-teal-300 transition-colors mt-0.5 truncate">{lesson.title}</h4>
                {lesson.hasModelBadge && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md bg-teal-950/40 border border-teal-500/30 text-teal-300 text-[10px] font-medium">
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
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-teal-300 group-hover:border-teal-400/40 shrink-0 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
