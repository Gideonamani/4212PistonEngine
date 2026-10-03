import React, { useEffect, useRef, useState } from 'react';
import { Lesson, LessonStep } from '../types/engine';
import { VisualIllustration } from './VisualIllustrations';
import { LessonMedia, LessonModelStage, isModelStep } from './LessonMedia';
import { preloadModels } from '../viewer/preload';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Check,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Info,
  X,
  Award,
  FileQuestion,
  ListRestart,
  PenLine,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { completeLesson, getLessonProgress, saveLessonReflection, saveLessonStep } from '../data/lessonProgress';
import { useShellChrome } from './ShellChrome';

interface LessonStepViewerProps {
  lesson: Lesson;
  onBackToLessons: () => void;
  deepDives?: Lesson[];
  onOpenDeepDive?: (lessonId: string) => void;
  onSwitchTo3DModel?: (modelName: string) => void;
  onTakeQuiz?: (lessonId: string) => void;
  initialStepIndex?: number;
  initialComplete?: boolean;
  onStepChange?: (stepIndex: number) => void;
  onComplete?: () => void;
}

export const LessonStepViewer: React.FC<LessonStepViewerProps> = ({
  lesson,
  onBackToLessons,
  deepDives,
  onOpenDeepDive,
  onSwitchTo3DModel,
  onTakeQuiz,
  initialStepIndex,
  initialComplete = false,
  onStepChange,
  onComplete,
}) => {
  const { setLessonImmersive } = useShellChrome();
  const initialProgress = getLessonProgress(lesson.id);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => Math.min(initialStepIndex ?? initialProgress.currentStep ?? 0, Math.max(lesson.steps.length - 1, 0)));
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<Record<number, boolean>>({});
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(initialComplete);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isWritingReflection, setIsWritingReflection] = useState(false);
  const [reflection, setReflection] = useState(initialProgress.reflection || '');
  const evidenceButtonRef = useRef<HTMLButtonElement>(null);
  const evidenceCloseRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const totalSteps = lesson.steps.length || 10;
  const currentStep: LessonStep = lesson.steps[currentStepIndex] || {
    stepNumber: currentStepIndex + 1,
    title: `Step ${currentStepIndex + 1}`,
    text: 'Continuing through the guided engineering curriculum.',
    imageType: 'steam',
    promptQuestion: 'How does this principle apply to modern aircraft piston engines?',
    promptPlaceholder: 'Write your thoughts here...',
    suggestedAnswer: 'Modern aviation engines balance thermodynamic efficiency, thermal dissipation, and strict weight constraints.',
  };

  const currentAnswer = userAnswers[currentStepIndex] || '';
  const percentComplete = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  const shouldShowMedia = currentStep.mediaPlan?.mode !== 'none';
  // The 3D viewer outlives non-model steps: keep the last model step so the loaded scene is only hidden, never rebuilt.
  const modelStep = isModelStep(currentStep) ? currentStep : undefined;
  const heldModelStep = useRef<LessonStep | undefined>(undefined);
  if (modelStep) heldModelStep.current = modelStep;
  const hasEvidence = Boolean(currentStep.note || currentStep.sourceRefs?.length || currentStep.credit || currentStep.license || currentStep.sourceUrl || (currentStep.url && /^https?:\/\//i.test(currentStep.url)));

  // Fetch every model this lesson uses in the background while the learner reads, in lesson order.
  useEffect(() => preloadModels(lesson.steps.filter(isModelStep).map((step) => step.modelId!)), [lesson.id]);

  useEffect(() => {
    setIsEvidenceOpen(false);
  }, [currentStepIndex]);

  useEffect(() => {
    saveLessonStep(lesson.id, currentStepIndex);
    if (!isComplete) onStepChange?.(currentStepIndex);
  }, [currentStepIndex, isComplete, lesson.id]);

  useEffect(() => {
    if (!isImmersive || document.fullscreenElement) return;
    const exitFallback = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImmersive(false);
        setLessonImmersive(false);
      }
    };
    window.addEventListener('keydown', exitFallback);
    return () => window.removeEventListener('keydown', exitFallback);
  }, [isImmersive, setLessonImmersive]);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === viewerRef.current;
      setIsImmersive(active);
      setLessonImmersive(active);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      setLessonImmersive(false);
    };
  }, [setLessonImmersive]);

  const toggleImmersive = async () => {
    if (isImmersive) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setIsImmersive(false);
      setLessonImmersive(false);
      return;
    }
    if (viewerRef.current?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await viewerRef.current.requestFullscreen();
        return;
      } catch {
        // Continue with the CSS immersive fallback.
      }
    }
    setIsImmersive(true);
    setLessonImmersive(true);
  };

  useEffect(() => {
    if (!isEvidenceOpen) return;
    evidenceCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEvidenceOpen(false);
        evidenceButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEvidenceOpen]);

  const closeEvidence = () => {
    setIsEvidenceOpen(false);
    evidenceButtonRef.current?.focus();
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      completeLesson(lesson.id, currentStepIndex);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#14b8a6', '#06b6d4', '#38bdf8', '#f59e0b'],
        });
      }
      setIsComplete(true);
      onComplete?.();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  if (isComplete) return <div className="flex h-full w-full overflow-y-auto bg-[#061014] px-4 py-6 text-slate-100">
    <section className="m-auto w-full max-w-xl rounded-3xl border border-teal-500/35 bg-gradient-to-br from-[#0a2427] via-[#08191e] to-[#050f13] p-5 shadow-2xl sm:p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-400/40 bg-teal-500/15 text-teal-300"><Award className="h-7 w-7" /></div>
      <p className="mt-5 font-mono text-[10px] font-bold tracking-[0.2em] text-teal-400">LESSON COMPLETE</p>
      <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">You completed {lesson.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">Your progress is saved on this device. Reflection and checking your knowledge are optional.</p>

      {isWritingReflection ? <div className="mt-5 rounded-2xl border border-teal-500/30 bg-[#061418] p-4"><label htmlFor="lesson-reflection" className="text-sm font-semibold text-white">What were the three most important things you learned?</label><textarea id="lesson-reflection" rows={6} autoFocus value={reflection} onChange={(event) => { setReflection(event.target.value); saveLessonReflection(lesson.id, event.target.value); }} placeholder="Write your reflection or summary here…" className="mt-3 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm leading-relaxed text-white placeholder:text-slate-500 focus:border-teal-400 focus:outline-none" /><p className="mt-2 text-[10px] text-slate-500">Saved locally as you type.</p></div> : null}

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <button type="button" onClick={() => setIsWritingReflection((value) => !value)} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-700 bg-slate-900/55 p-3.5 text-left transition hover:border-teal-400"><PenLine className="h-5 w-5 text-teal-300" /><span className="mt-3 text-xs font-bold text-white">{isWritingReflection ? 'Close reflection' : 'Write a reflection'}</span></button>
        <button type="button" onClick={() => onTakeQuiz?.(lesson.id)} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-700 bg-slate-900/55 p-3.5 text-left transition hover:border-teal-400"><FileQuestion className="h-5 w-5 text-teal-300" /><span className="mt-3 text-xs font-bold text-white">Take this lesson’s quiz</span></button>
        <button type="button" onClick={onBackToLessons} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-700 bg-slate-900/55 p-3.5 text-left transition hover:border-teal-400"><ListRestart className="h-5 w-5 text-teal-300" /><span className="mt-3 text-xs font-bold text-white">Return to lessons</span></button>
      </div>
    </section>
  </div>;

  return (
    <div ref={viewerRef} className={`relative flex h-full w-full flex-col overflow-y-auto bg-[#061014] text-slate-100 ${isImmersive && !document.fullscreenElement ? 'fixed inset-0 z-[100] h-[100dvh]' : ''}`}>
      {/* Top Navigation Bar */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
        <button
          onClick={onBackToLessons}
          className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-800/60 transition-colors"
          aria-label="Back to lessons"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Lessons</span>
        </button>
        <div className="flex items-center gap-2">
          {hasEvidence && <button ref={evidenceButtonRef} type="button" onClick={() => setIsEvidenceOpen(true)} aria-label="Open evidence and scope note" aria-haspopup="dialog" aria-controls="lesson-evidence-dialog" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-teal-400 hover:text-teal-300"><Info className="h-4 w-4" /></button>}
          <button type="button" onClick={toggleImmersive} aria-label={isImmersive ? 'Exit full-screen lesson' : 'Open full-screen lesson'} aria-pressed={isImmersive} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-teal-400 hover:text-teal-300">{isImmersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
        </div>
      </div>

      {/* Stepper Progress Section (Matching Screenshot 5) */}
      <div className="px-5 pt-3 pb-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold">{lesson.lessonNumber}</span>
            <span className="text-slate-600">|</span>
            <span className="text-white">Step {currentStepIndex + 1} of {totalSteps}</span>
          </div>
          <span className="text-teal-400 font-mono text-[11px] font-bold">
            {percentComplete}% complete
          </span>
        </div>

        {/* Step Nodes Bar with connecting lines */}
        <div className="flex items-center justify-between gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none py-1 w-full">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <React.Fragment key={idx}>
                <button
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-mono transition-all shrink-0 ${
                    isCompleted
                      ? 'bg-teal-500 text-slate-950 shadow-xs shadow-teal-500/50'
                      : isCurrent
                      ? 'border-2 border-teal-400 text-teal-300 bg-teal-950/40 shadow-sm shadow-teal-400/40 scale-105'
                      : 'border border-slate-700 text-slate-500 bg-slate-900/40 hover:border-slate-500'
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                >
                  {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                </button>

                {idx < totalSteps - 1 && (
                  <div
                    className={`flex-1 h-0.5 min-w-[3px] sm:min-w-[6px] transition-colors ${
                      idx < currentStepIndex ? 'bg-teal-500' : 'bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Step Content Card (Matching Screenshot 5) */}
      <div className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-2 pb-20 ${isImmersive ? 'max-w-5xl' : 'max-w-xl'}`}>
        <div className="p-4 rounded-2xl bg-[#09191f]/90 border border-teal-500/20 shadow-xl flex flex-col gap-3.5">
          <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
            STEP {currentStepIndex + 1}
          </div>

          {/* Published media, a clearly labelled production placeholder, or legacy illustration. */}
          {heldModelStep.current && <LessonModelStage step={heldModelStep.current} active={Boolean(modelStep)} immersive={isImmersive} onSwitchTo3DModel={onSwitchTo3DModel} />}
          {shouldShowMedia && !modelStep && <LessonMedia step={currentStep} immersive={isImmersive} onSwitchTo3DModel={onSwitchTo3DModel} />}

          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            {currentStep.title}
          </h2>

          {/* Body Prose */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {currentStep.text}
          </p>

          {/* Optional deep dives: unlisted lessons, never required to progress. */}
          {currentStep.deepDiveLinks?.map((linkId) => {
            const target = deepDives?.find((item) => item.id === linkId);
            return target ? <button key={linkId} type="button" onClick={() => onOpenDeepDive?.(linkId)} className="flex items-center justify-between gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2.5 text-left text-xs font-semibold text-teal-200 transition hover:border-teal-400"><span><span className="block font-mono text-[10px] uppercase tracking-widest text-teal-400">Optional deep dive</span>{target.title}</span><span aria-hidden="true">→</span></button> : null;
          })}

          {/* GUIDED PROMPT Card (Matching Screenshot 5) */}
          {currentStep.promptQuestion && (
            <div className="p-3.5 rounded-xl bg-[#061418] border border-teal-500/30 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-teal-400">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-mono tracking-wider font-semibold uppercase">
                  GUIDED PROMPT
                </span>
              </div>

              <p className="text-xs font-medium text-slate-200 leading-snug">
                {currentStep.promptQuestion}
              </p>

              {/* Textarea Input */}
              <div className="relative">
                <textarea
                  rows={3}
                  value={currentAnswer}
                  onChange={(e) =>
                    setUserAnswers((prev) => ({
                      ...prev,
                      [currentStepIndex]: e.target.value,
                    }))
                  }
                  placeholder={currentStep.promptPlaceholder || 'Write your thoughts here...'}
                  className="w-full p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                  <span>Optional · For your learning</span>
                  {currentStep.suggestedAnswer && (
                    <button
                      onClick={() =>
                        setShowAnswerFeedback((prev) => ({
                          ...prev,
                          [currentStepIndex]: !prev[currentStepIndex],
                        }))
                      }
                      className="text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{showAnswerFeedback[currentStepIndex] ? 'Hide Insight' : 'Instructor Insight'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Instructor Insight Accordion */}
              {showAnswerFeedback[currentStepIndex] && currentStep.suggestedAnswer && (
                <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/30 text-xs text-teal-100 leading-relaxed animate-in fade-in duration-200">
                  <div className="text-[10px] font-mono font-semibold text-teal-300 mb-0.5">
                    AEROSPACE ENGINEERING CONTEXT:
                  </div>
                  {currentStep.suggestedAnswer}
                </div>
              )}
            </div>
          )}

          {/* Navigation Action Buttons Row (Matching Screenshot 5) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                currentStepIndex === 0
                  ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-900/60 hover:bg-slate-800 border-slate-700 text-slate-300 active:scale-98'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={handleNextStep}
              className="py-2.5 px-4 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-400/25 active:scale-98 transition-all"
            >
              <span>{currentStepIndex === totalSteps - 1 ? 'Complete Lesson' : 'Next Step'}</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {isEvidenceOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEvidence(); }}>
        <section id="lesson-evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-evidence-title" className="max-h-[75dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-teal-500/30 bg-[#09191f] p-4 text-slate-200 shadow-2xl sm:p-5">
          <div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[10px] font-bold tracking-widest text-teal-400">STEP {currentStepIndex + 1}</span><h2 id="lesson-evidence-title" className="mt-1 text-base font-bold text-white">Evidence &amp; scope note</h2></div><button ref={evidenceCloseRef} type="button" onClick={closeEvidence} aria-label="Close evidence and scope note" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-300"><X className="h-4 w-4" /></button></div>
          {currentStep.note && <p className="mt-4 text-sm leading-relaxed text-slate-300">{currentStep.note}</p>}
          {(currentStep.credit || currentStep.license) && <p className="mt-3 text-xs leading-relaxed text-slate-400"><span className="font-semibold text-slate-300">Media:</span> {[currentStep.credit, currentStep.license].filter(Boolean).join(' · ')}</p>}
          {currentStep.sourceUrl ? <a href={currentStep.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-teal-300 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-200">Open media source</a> : null}
          {currentStep.sourceRefs?.length ? <div className="mt-4 border-t border-slate-700/70 pt-3"><h3 className="font-mono text-[10px] font-bold tracking-wider text-slate-400">SOURCE REFERENCES</h3><ul className="mt-2 space-y-2 text-xs text-slate-300">{currentStep.sourceRefs.map((reference) => <li key={reference} className="break-words">{/^https?:\/\//i.test(reference) ? <a href={reference} target="_blank" rel="noreferrer" className="text-teal-300 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-200">{reference}</a> : reference}</li>)}</ul></div> : null}
          {currentStep.url && /^https?:\/\//i.test(currentStep.url) ? <a href={currentStep.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-semibold text-teal-300 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-200">Open supporting source</a> : null}
        </section>
      </div>}

      {/* Bottom Mini Dock (Contained within frame) */}
      <div className="sticky bottom-0 left-0 right-0 z-20 px-4 py-2 bg-[#061014]/95 backdrop-blur-md border-t border-teal-500/15 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Mini Thumbnail */}
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-teal-500/20 shrink-0">
            <VisualIllustration type={currentStep.imageType} className="w-full h-full" />
          </div>

          {/* Mini Dots / Bar */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i < (currentStepIndex % 6) + 1 ? 'w-5 bg-teal-400' : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-300">
            {currentStepIndex + 1} / {totalSteps}
          </span>
          <button
            onClick={onBackToLessons}
            className="p-1 text-slate-400 hover:text-white"
            aria-label="Back to lessons"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
