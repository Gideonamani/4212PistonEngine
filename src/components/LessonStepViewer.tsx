import React, { useEffect, useRef, useState } from 'react';
import { Lesson, LessonStep } from '../types/engine';
import { LessonMedia, LessonModelStage, isModelStep, stepHasMedia } from './LessonMedia';
import { preloadModels } from '../viewer/preload';
import { ChevronLeft, ChevronRight, Columns2, Info, Maximize2, Minimize2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { completeLesson, getLessonProgress, saveLessonStep } from '../data/lessonProgress';
import { BackLink, IconButton, ReviewChip } from './ui';
import { ProgressNavigator, type ProgressItem } from './ProgressNavigator';
import { EvidenceDialog, stepHasEvidence } from './lesson/EvidenceDialog';
import { GuidedPrompt } from './lesson/GuidedPrompt';
import { LessonComplete } from './lesson/LessonComplete';
import { LessonDock } from './lesson/LessonDock';
import { useLessonFullscreen } from './lesson/useLessonFullscreen';
import { useLessonLayout } from './lesson/useLessonLayout';
import { useScrollArea } from './lesson/useScrollArea';

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

const CARD_LOOK = 'rounded-2xl border border-teal-500/20 bg-[#09191f]/90 shadow-xl';

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
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => Math.min(initialStepIndex ?? getLessonProgress(lesson.id).currentStep ?? 0, Math.max(lesson.steps.length - 1, 0)));
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<Record<number, boolean>>({});
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(initialComplete);
  const evidenceButtonRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { isImmersive, coversPage, toggleImmersive } = useLessonFullscreen(viewerRef);
  const { layout, canChoose: canChooseLayout, choose: chooseLayout } = useLessonLayout();
  useScrollArea(viewerRef);

  const totalSteps = lesson.steps.length || 10;
  const currentStep: LessonStep = lesson.steps[currentStepIndex] || {
    stepNumber: currentStepIndex + 1,
    title: `Step ${currentStepIndex + 1}`,
    text: 'Continuing through the guided engineering curriculum.',
    promptQuestion: 'How does this principle apply to modern aircraft piston engines?',
    promptPlaceholder: 'Write your thoughts here...',
    suggestedAnswer: 'Modern aviation engines balance thermodynamic efficiency, thermal dissipation, and strict weight constraints.',
  };

  const percentComplete = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  const shouldShowMedia = stepHasMedia(currentStep);
  const side = layout === 'side';
  // Side by side has a media column only while the step has media; a step without any takes the whole width for its text.
  const twoColumns = side && shouldShowMedia;
  // The 3D viewer outlives non-model steps: keep the last model step so the loaded scene is only hidden, never rebuilt.
  const modelStep = isModelStep(currentStep) ? currentStep : undefined;
  const heldModelStep = useRef<LessonStep | undefined>(undefined);
  if (modelStep) heldModelStep.current = modelStep;

  // Fetch every model this lesson uses in the background while the learner reads, in lesson order.
  useEffect(() => preloadModels(lesson.steps.filter(isModelStep).map((step) => step.modelId!)), [lesson.id]);

  useEffect(() => {
    setIsEvidenceOpen(false);
  }, [currentStepIndex]);

  useEffect(() => {
    saveLessonStep(lesson.id, currentStepIndex);
    if (!isComplete) onStepChange?.(currentStepIndex);
  }, [currentStepIndex, isComplete, lesson.id]);

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

  if (isComplete) return <LessonComplete lesson={lesson} onTakeQuiz={onTakeQuiz} onBackToLessons={onBackToLessons} />;

  const stepLabel = <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tracking-widest text-slate-400 uppercase font-semibold">STEP {currentStepIndex + 1}<ReviewChip lesson={lesson} /></div>;

  // One tree for both layouts: only classes change, so the 3D stage keeps its place in React and is never rebuilt when the learner
  // switches. Stacked, the wrappers marked `contents` vanish and the page is the single column it always was. Side by side, the page
  // becomes a grid: the viewer in the left column (pinned while you scroll), the back bar, progress bar and text in the right.
  return (
    <div ref={viewerRef} className={`relative flex h-full w-full flex-col overflow-y-auto bg-[#061014] text-slate-100 ${coversPage ? 'fixed inset-0 z-[100] h-[100dvh]' : ''}`}>
      <div className={side ? `mx-auto grid w-full max-w-6xl flex-1 content-start items-start gap-x-4 px-4 pb-4 ${twoColumns ? 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] grid-rows-[auto_auto_1fr]' : 'grid-cols-1'}` : 'contents'}>
        {/* Top Navigation Bar */}
        <div className={`flex items-center justify-between ${side ? `pt-3 pb-1 ${twoColumns ? 'col-start-2 row-start-1' : ''}` : 'px-5 pt-3 pb-1'}`}>
          <BackLink label="Back to Lessons" ariaLabel="Back to lessons" onClick={onBackToLessons} />
          <div className="-my-1.5 -mr-1.5 flex items-center">
            {canChooseLayout && <IconButton size="sm" label="Side-by-side layout" title="Show the model beside the text" active={side} onClick={() => chooseLayout(side ? 'stacked' : 'side')}><Columns2 className="h-4 w-4" /></IconButton>}
            {stepHasEvidence(currentStep) && <IconButton ref={evidenceButtonRef} size="sm" label="Open evidence and scope note" aria-haspopup="dialog" aria-controls="lesson-evidence-dialog" onClick={() => setIsEvidenceOpen(true)}><Info className="h-4 w-4" /></IconButton>}
            <IconButton size="sm" label={isImmersive ? 'Exit full-screen lesson' : 'Open full-screen lesson'} active={isImmersive} onClick={toggleImmersive}>{isImmersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</IconButton>
          </div>
        </div>

        {/* Where you are in the lesson; tap it for the list of steps. */}
        <div className={side ? `pt-3 pb-2 ${twoColumns ? 'col-start-2 row-start-2' : ''}` : 'px-5 pt-3 pb-2'}>
          <ProgressNavigator
            noun="step"
            heading="Steps in this lesson"
            currentIndex={currentStepIndex}
            onSelect={setCurrentStepIndex}
            items={lesson.steps.map((step, index): ProgressItem => ({ id: String(index), title: step.title || `Step ${index + 1}`, state: index < currentStepIndex ? 'done' : 'todo' }))}
            summary={<>
              <span className="flex items-center gap-2">
                <span className="text-slate-300 font-semibold">{lesson.lessonNumber}</span>
                <span className="text-slate-600">|</span>
                <span className="text-white">Step {currentStepIndex + 1} of {totalSteps}</span>
              </span>
              <span className="ml-auto text-teal-400 font-mono text-[11px] font-bold">{percentComplete}% complete</span>
            </>}
          />
        </div>

        {/* Main Step Content Card (Matching Screenshot 5) */}
        <div className={side ? 'contents' : `mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-2 pb-20 ${isImmersive ? 'max-w-5xl' : 'max-w-xl'}`}>
          <div className={side ? 'contents' : `flex flex-col gap-3.5 p-4 ${CARD_LOOK}`}>
            {!side && stepLabel}

            {/* Published media or a clearly labelled production placeholder; a step with neither gets no slot. Side by side, the 3D viewer is pinned. */}
            <div className={twoColumns ? `col-start-1 row-span-3 row-start-1 self-start ${modelStep ? 'lesson-media-side sticky top-2' : 'pt-3'}` : 'contents'}>
              {heldModelStep.current && <LessonModelStage step={heldModelStep.current} active={Boolean(modelStep)} immersive={isImmersive} layout={side ? 'side' : 'stacked'} onSwitchTo3DModel={onSwitchTo3DModel} />}
              {shouldShowMedia && !modelStep && <LessonMedia step={currentStep} immersive={isImmersive} />}
            </div>

            <div className={side ? `flex flex-col gap-3.5 p-4 ${CARD_LOOK} ${twoColumns ? 'col-start-2 row-start-3' : 'mx-auto w-full max-w-2xl'}` : 'flex flex-col gap-3.5'}>
              {side && stepLabel}

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
                return target ? <button key={linkId} type="button" onClick={() => onOpenDeepDive?.(linkId)} className="flex items-center justify-between gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2.5 text-left text-xs font-semibold text-teal-200 transition hover:border-teal-400"><span><span className="block font-mono text-[11px] uppercase tracking-widest text-teal-400">Optional deep dive</span>{target.title}</span><span aria-hidden="true">→</span></button> : null;
              })}

              <GuidedPrompt
                step={currentStep}
                answer={userAnswers[currentStepIndex] || ''}
                onAnswerChange={(value) => setUserAnswers((prev) => ({ ...prev, [currentStepIndex]: value }))}
                showInsight={Boolean(showAnswerFeedback[currentStepIndex])}
                onToggleInsight={() => setShowAnswerFeedback((prev) => ({ ...prev, [currentStepIndex]: !prev[currentStepIndex] }))}
              />

              {/* Navigation Action Buttons Row (Matching Screenshot 5) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  className={`min-h-11 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
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
                  className="min-h-11 px-4 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-400/25 active:scale-98 transition-all"
                >
                  <span>{currentStepIndex === totalSteps - 1 ? 'Complete Lesson' : 'Next Step'}</span>
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEvidenceOpen && <EvidenceDialog step={currentStep} stepNumber={currentStepIndex + 1} onClose={closeEvidence} />}

      {/* Side by side there is no height to spare for the dock: the back link and the step list already sit beside the text. */}
      {!side && <LessonDock thumbnail={lesson.thumbnail} stepNumber={currentStepIndex + 1} totalSteps={totalSteps} percentComplete={percentComplete} onBackToLessons={onBackToLessons} />}
    </div>
  );
};
