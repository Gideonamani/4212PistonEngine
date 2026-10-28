import React, { useEffect, useMemo } from 'react';
import { modelsById } from '../../data/modelRegistry';
import type { ModelClickQuestion } from '../../types/engine';
import { lessonProfile } from '../../viewer/core/view-state.mjs';
import { UnknownModel } from '../../viewer/ViewerParts';
import { useModelViewer, type ModelViewerState } from '../../viewer/useModelViewer';
import { PartStage } from './PartStage';
import { acceptedNodeIds, nodeIdsOf } from './scoring.mjs';

type PartPickerBodyProps = {
  /** The model the learner taps, owned by the caller so one model can serve several questions in a row. */
  viewer: ModelViewerState;
  /** The question being answered; none while the questions are still being made or after the last. */
  question: ModelClickQuestion | undefined;
  /** The node ids the tapped part answers to (its own id first), or undefined while nothing is tapped. */
  answer: string[] | undefined;
  onAnswer: (answer: string[]) => void;
  /** True once the answer is verified: tapping stops counting and the right part is shown. */
  revealed: boolean;
  tall?: boolean;
};

/**
 * The answer area of a model-click question: a 3D model the learner taps, with the means to hide parts and look beneath them. The model's
 * own picking does the work: a tap selects a component (highlighting it), and the component's id and groups become the answer. The part's
 * name is never shown before Verify, so tapping around cannot find the answer by reading labels, and no list of names is offered.
 */
export function PartPickerBody({ viewer, question, answer, onAnswer, revealed, tall }: PartPickerBodyProps) {
  const components = viewer.features?.components;
  const focus = viewer.features?.focus;
  const selectedId = viewer.snapshot.selectedId;
  const label = (id?: string) => components?.items.find((item) => item.id === id)?.label ?? components?.groups.find((group) => group.id === id)?.label;

  // A tap selects a component in the model; its ids are the answer until the answer is verified. Hiding the tapped part clears it.
  useEffect(() => {
    if (revealed || !components || !question) return;
    if (!selectedId) {
      if (answer?.length) onAnswer([]);
      return;
    }
    const ids = nodeIdsOf(components.items.find((item) => item.id === selectedId));
    if (ids.length && ids.join('|') !== (answer ?? []).join('|')) onAnswer(ids);
  }, [selectedId, components, revealed]);

  // Once verified, every part that was right is shown, whatever was tapped and whatever was hidden. A part that was inside the engine is
  // shown on its own, because among the ghosts of the parts around it nothing stands out; any other is highlighted where it sits, and the
  // camera moves to it.
  const buried = Boolean(question?.generated?.buried);
  useEffect(() => {
    if (!revealed || !components || !question) return;
    const right = components.items.filter((item) => acceptedNodeIds(question).some((id) => nodeIdsOf(item).includes(id))).map((item) => item.id);
    components.showHidden?.();
    components.select('');
    if (right.length && focus) focus.set(right, buried ? 'isolate' : 'highlight');
    if (right.length && !buried) components.frame?.(right);
  }, [revealed, components, question?.id]);

  const tapped = answer?.[0];
  const rightLabel = question?.generated?.answer ?? label(question?.correctNodeId) ?? question?.correctNodeId;

  return <div className="flex flex-col gap-2.5">
    <PartStage viewer={viewer} tall={tall} />
    {question && <p role="status" className="text-xs leading-snug text-slate-300">
      {revealed
        ? <>You tapped <strong className="text-white">{label(tapped) ?? 'no part'}</strong>. The right answer is <strong className="text-teal-200">{rightLabel}</strong>{acceptedNodeIds(question).length > 1 && !question.generated ? ' (or another part that counts)' : ''}.{buried ? ' It is shown on its own; tap Show all to see the whole model again.' : ''}</>
        : tapped
          ? 'A part is highlighted. Tap another to change your answer, then verify.'
          : 'Tap a part on the model to choose it. Drag to turn the model, pinch to zoom.'}
    </p>}
  </div>;
}

type PartPickerProps = Omit<PartPickerBodyProps, 'viewer' | 'question'> & { question: ModelClickQuestion };

/** A model-click question inside a lesson pack's check: it opens its own model, because the question names which one. */
export default function PartPicker({ question, ...rest }: PartPickerProps) {
  const definition = modelsById[question.modelId];
  const view = useMemo(() => ({ initialAngle: question.view?.initialAngle }), [question.view?.initialAngle]);
  const viewer = useModelViewer(question.modelId, lessonProfile(definition?.adapter), view);
  if (!definition) return <UnknownModel modelId={question.modelId} />;
  return <PartPickerBody viewer={viewer} question={question} {...rest} />;
}
