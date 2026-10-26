import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Lesson, LessonStep } from '../types/engine';
import { LessonMedia, LessonModelStage, isModelStep, stepHasMedia } from './LessonMedia';
import { preloadModels } from '../viewer/preload';
import { ChevronLeft, ChevronRight, Columns2, Info, Maximize2, Minimize2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { completeLesson, getLessonProgress, saveLessonStep } from '../data/lessonProgress';
import { BackLink, IconButton, ReviewChip } from './ui';
import { ProgressNavigator, ProgressSheet, type ProgressItem } from './ProgressNavigator';
import { EvidenceDialog, stepHasEvidence } from './lesson/EvidenceDialog';
import { GuidedPrompt } from './lesson/GuidedPrompt';
import { LessonComplete } from './lesson/LessonComplete';
import { LessonFooter } from './lesson/LessonFooter';
import { LessonOpener } from './lesson/LessonOpener';
import { useLessonFullscreen } from './lesson/useLessonFullscreen';
import { useLessonLayout } from './lesson/useLessonLayout';
import { TextSizeControl, useLessonTextSize } from './lesson/TextSize';
import { StepText } from './lesson/StepText';
import { CHIPS_MIN_PARTS, toggleChip } from '../viewer/core/step-part-chips.mjs';
import type { PartPick } from '../viewer/controls/StepPartChips';
import { useScrollArea } from './lesson/useScrollArea';
import { useStepSwipe, type SwipeDirection } from './lesson/useStepSwipe';

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

const CARD_LOOK = 'rounded-2xl border border-teal-500/20 bg-panel/90 shadow-xl';

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
  const [stepsOpen, setStepsOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SwipeDirection>(null);
  const evidenceButtonRef = useRef<HTMLButtonElement>(null);
  const footerTriggerRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  // Where the 3D viewer draws the step's part chips: just under the step's text (see StepPartChips).
  const [chipSlot, setChipSlot] = useState<HTMLDivElement | null>(null);
  // The part chosen to look at alone, by a chip or by a linked word in the text, and whether the chips (and so the words) are on show.
  // A choice belongs to the step it was made on: a new step starts from its own spotlight.
  const [partChoice, setPartChoice] = useState<{ step: number; id?: string }>({ step: -1 });
  const [partsOffered, setPartsOffered] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const { isImmersive, coversPage, toggleImmersive } = useLessonFullscreen(viewerRef);
  const { layout, canChoose: canChooseLayout, choose: chooseLayout } = useLessonLayout();
  useScrollArea(viewerRef);
  const { size: textSize, choose: chooseTextSize } = useLessonTextSize();

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
    setPartChoice({ step: -1 });
  }, [currentStepIndex]);

  const chosenPart = partChoice.step === currentStepIndex ? partChoice.id : undefined;
  const partPick = useMemo<PartPick>(() => ({
    selected: chosenPart,
    choose: (id) => setPartChoice({ step: currentStepIndex, id }),
    offered: setPartsOffered,
  }), [chosenPart, currentStepIndex]);

  // A word sits mid-paragraph, and on a phone the model above it may have scrolled out of sight: choosing a part brings the model back
  // into view when less than half of it shows, so the learner sees what the tap did.
  const chooseLinkedPart = useCallback((id: string) => {
    const next = toggleChip(chosenPart, id);
    partPick.choose(next);
    const stage = stageRef.current, area = viewerRef.current;
    if (!next || !stage || !area) return;
    const box = stage.getBoundingClientRect(), view = area.getBoundingClientRect();
    const shown = Math.min(box.bottom, view.bottom) - Math.max(box.top, view.top);
    if (shown < box.height / 2) stage.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [chosenPart, partPick]);

  useEffect(() => {
    saveLessonStep(lesson.id, currentStepIndex);
    if (!isComplete) onStepChange?.(currentStepIndex);
  }, [currentStepIndex, isComplete, lesson.id]);

  // Synchronously reset scroll position to top before the browser paints the new step (no visible flash)
  useLayoutEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentStepIndex]);

  const closeEvidence = () => {
    setIsEvidenceOpen(false);
    evidenceButtonRef.current?.focus();
  };

  const closeSteps = () => {
    setStepsOpen(false);
    footerTriggerRef.current?.focus();
  };

  // One entry per step for the list of steps, whichever layout opens it.
  const stepItems = lesson.steps.map((step, index): ProgressItem => ({ id: String(index), title: step.title || `Step ${index + 1}`, state: index < currentStepIndex ? 'done' : 'todo', hasModel: isModelStep(step) }));

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setSlideDirection('forward');
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
      setSlideDirection('backward');
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSelectStep = (index: number) => {
    if (index !== currentStepIndex) {
      setSlideDirection(index > currentStepIndex ? 'forward' : 'backward');
      setCurrentStepIndex(index);
    }
  };

  // Swipe gesture navigation for touch devices with exclusion zones
  useStepSwipe(viewerRef, {
    onSwipeNext: handleNextStep,
    onSwipePrev: handlePrevStep,
    canGoNext: currentStepIndex < totalSteps - 1,
    canGoPrev: currentStepIndex > 0,
    disabled: isComplete || isEvidenceOpen || stepsOpen,
  });

  if (isComplete) return <LessonComplete lesson={lesson} onTakeQuiz={onTakeQuiz} onBackToLessons={onBackToLessons} />;

  const stepLabel = <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tracking-widest text-slate-400 uppercase font-semibold">STEP {currentStepIndex + 1}<ReviewChip lesson={lesson} /></div>;

  // One tree for both layouts: only classes change, so the 3D stage keeps its place in React and is never rebuilt when the learner
  // switches. Stacked, the wrappers marked `contents` vanish and the page is the single column it always was. Side by side, the page
  // becomes a grid: the viewer in the left column (pinned while you scroll), the back bar, progress bar and text in the right.
  return (
    <div ref={viewerRef} style={{ '--lesson-text-scale': textSize.scale } as React.CSSProperties} className={`relative flex h-full w-full flex-col overflow-y-auto bg-canvas text-slate-100 ${coversPage ? 'fixed inset-0 z-[100] h-[100dvh]' : ''}`}>
      <div className={side ? `mx-auto grid w-full max-w-6xl flex-1 content-start items-start gap-x-4 px-4 pb-4 ${twoColumns ? 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] grid-rows-[auto_auto_1fr]' : 'grid-cols-1'}` : 'contents'}>
        {/* Top Navigation Bar */}
        <div className={`flex items-center justify-between ${side ? `pt-3 pb-1 ${twoColumns ? 'col-start-2 row-start-1' : ''}` : 'px-5 pt-3 pb-1'}`}>
          <BackLink label="Back to Lessons" ariaLabel="Back to lessons" onClick={onBackToLessons} />
          <div className="-my-1.5 -mr-1.5 flex items-center">
            <TextSizeControl value={textSize.id} onChange={chooseTextSize} />
            {canChooseLayout && <IconButton size="sm" label="Side-by-side layout" title="Show the model beside the text" active={side} onClick={() => chooseLayout(side ? 'stacked' : 'side')}><Columns2 className="h-4 w-4" /></IconButton>}
            {stepHasEvidence(currentStep) && <IconButton ref={evidenceButtonRef} size="sm" label="Open evidence and scope note" aria-haspopup="dialog" aria-controls="lesson-evidence-dialog" onClick={() => setIsEvidenceOpen(true)}><Info className="h-4 w-4" /></IconButton>}
            <IconButton size="sm" label={isImmersive ? 'Exit full-screen lesson' : 'Open full-screen lesson'} active={isImmersive} onClick={toggleImmersive}>{isImmersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</IconButton>
          </div>
        </div>

        {/* Side by side, where you are in the lesson sits above the text; tap it for the list of steps. Stacked, it lives in the footer. */}
        {side && (
          <div className={`pt-3 pb-2 ${twoColumns ? 'col-start-2 row-start-2' : ''}`}>
            <ProgressNavigator
              noun="step"
              heading="Steps in this lesson"
              currentIndex={currentStepIndex}
              onSelect={handleSelectStep}
              items={stepItems}
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
        )}

        {/* Main Step Content Card (Matching Screenshot 5) */}
        <div className={side ? 'contents' : `mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-2 pb-20 ${isImmersive ? 'max-w-5xl' : 'max-w-xl'}`}>
          <div className={side ? 'contents' : `flex flex-col gap-3.5 p-4 ${CARD_LOOK}`}>
            {!side && stepLabel}

            {/* Published media or a clearly labelled production placeholder; a step with neither gets no slot. Side by side, the 3D viewer is pinned. */}
            <div className={twoColumns ? `col-start-1 row-span-3 row-start-1 self-start pt-3 ${modelStep ? 'lesson-media-side sticky top-0' : ''}` : 'contents'}>
              {heldModelStep.current && <LessonModelStage step={heldModelStep.current} active={Boolean(modelStep)} immersive={isImmersive} layout={side ? 'side' : 'stacked'} chipSlot={chipSlot} partPick={partPick} stageRef={stageRef} onSwitchTo3DModel={onSwitchTo3DModel} />}
              {shouldShowMedia && !modelStep && <LessonMedia step={currentStep} immersive={isImmersive} />}
            </div>

            <div
              key={currentStepIndex}
              onAnimationEnd={() => setSlideDirection(null)}
              className={`${
                side
                  ? `flex flex-col gap-3.5 p-4 ${CARD_LOOK} ${twoColumns ? 'col-start-2 row-start-3' : 'mx-auto w-full max-w-2xl'}`
                  : 'flex flex-col gap-3.5'
              } ${
                slideDirection === 'forward'
                  ? 'step-slide-forward'
                  : slideDirection === 'backward'
                  ? 'step-slide-backward'
                  : ''
              }`}
            >
              {side && stepLabel}

              {/* The first step opens the lesson: what it is for, and (folded away) what the learner will be able to do. */}
              {currentStepIndex === 0 && <LessonOpener lesson={lesson} />}

              {/* Heading */}
              <h2 className="lesson-heading font-bold tracking-tight text-white mt-1">
                {currentStep.title}
              </h2>

              {/* Body prose, as short paragraphs, with any words linked to a part as buttons that spotlight it (see StepText). */}
              <StepText text={currentStep.text} linkable={Boolean(modelStep) && partsOffered} selected={chosenPart} onChoose={chooseLinkedPart} />

              {/* A step that spotlights two or more parts gets a chip for each, drawn here by the viewer (see StepPartChips). */}
              {modelStep && (modelStep.focusParts?.length ?? 0) >= CHIPS_MIN_PARTS && <div ref={setChipSlot} className="empty:hidden" />}

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

      {/* Side by side there is no height to spare for a footer: the back link and the step list already sit beside the text. */}
      {!side && <LessonFooter ref={footerTriggerRef} thumbnail={lesson.thumbnail} lessonNumber={lesson.lessonNumber} stepNumber={currentStepIndex + 1} totalSteps={totalSteps} percentComplete={percentComplete} expanded={stepsOpen} onOpenSteps={() => setStepsOpen(true)} />}
      {!side && stepsOpen && (
        <ProgressSheet
          noun="step"
          heading="Steps in this lesson"
          currentIndex={currentStepIndex}
          onSelect={handleSelectStep}
          onClose={closeSteps}
          items={stepItems}
          identity={{
            thumbnail: lesson.thumbnail,
            eyebrow: lesson.lessonNumber,
            title: lesson.title,
            summary: <>
              <span className="text-white">Step {currentStepIndex + 1} of {totalSteps}</span>
              <span className="font-mono text-[11px] font-bold text-teal-300">{percentComplete}% complete</span>
            </>,
          }}
        />
      )}
    </div>
  );
};
