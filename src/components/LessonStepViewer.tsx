import React, { useState } from 'react';
import { Lesson, LessonStep } from '../types/engine';
import { VisualIllustration } from './VisualIllustrations';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Check,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Box,
  Construction,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LessonStepViewerProps {
  lesson: Lesson;
  onBackToLessons: () => void;
  onSwitchTo3DModel?: (modelName: string) => void;
}

export const LessonStepViewer: React.FC<LessonStepViewerProps> = ({
  lesson,
  onBackToLessons,
  onSwitchTo3DModel,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<Record<number, boolean>>({});

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
  const mediaIsPlanned = currentStep.mediaPlan?.status === 'planned' || currentStep.url?.startsWith('PLACEHOLDER:');
  const shouldShowMedia = currentStep.mediaPlan?.mode !== 'none';

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Completed lesson celebration!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#14b8a6', '#06b6d4', '#38bdf8', '#f59e0b'],
      });
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#061014] text-slate-100 overflow-y-auto">
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
        <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold">
          {lesson.lessonNumber}
        </span>
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
      <div className="flex-1 px-4 py-2 flex flex-col gap-4 max-w-xl mx-auto w-full pb-20">
        <div className="p-4 rounded-2xl bg-[#09191f]/90 border border-teal-500/20 shadow-xl flex flex-col gap-3.5">
          <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
            STEP {currentStepIndex + 1}
          </div>

          {/* Published media, a clearly labelled production placeholder, or legacy illustration. */}
          {shouldShowMedia && <div className="w-full h-44 sm:h-52 rounded-xl overflow-hidden shadow-inner border border-white/5 relative">
            {mediaIsPlanned ? <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0b2429] to-[#071317] px-6 text-center"><Construction className="h-7 w-7 text-teal-400" /><span className="mt-2 font-mono text-[10px] font-bold tracking-widest text-teal-300">PLANNED LEARNING MEDIA</span><p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-300">{currentStep.mediaPlan?.assetBrief || currentStep.mediaPlan?.rationale || 'This activity is specified in the lesson pack and is awaiting its published media asset.'}</p></div> : <VisualIllustration type={currentStep.imageType} className="w-full h-full" />}

            {/* 3D Model Reference Button (if available for step) */}
            {currentStep.has3DReference && !mediaIsPlanned && (
              <button
                onClick={() => onSwitchTo3DModel?.(currentStep.referenceModel || 'Wright 1903 Aero Cylinder')}
                className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <Box className="w-3.5 h-3.5" />
                <span>Inspect 3D Model</span>
              </button>
            )}
          </div>}

          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            {currentStep.title}
          </h2>

          {/* Body Prose */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {currentStep.text}
          </p>

          {currentStep.note && (
            <details className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-3 text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold text-teal-300">Evidence and scope note</summary>
              <p className="mt-2 leading-relaxed">{currentStep.note}</p>
            </details>
          )}

          {currentStep.sourceRefs?.length ? <div className="font-mono text-[10px] text-slate-500">SOURCE REFS · {currentStep.sourceRefs.join(' · ')}</div> : null}

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
