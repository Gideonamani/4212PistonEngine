import React, { useEffect, useId, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { modelsById } from '../../data/modelRegistry';
import type { ModelClickQuestion } from '../../types/engine';
import { lessonProfile } from '../../viewer/core/view-state.mjs';
import { ModelCanvas, PanToggle, ToolbarButton, UnknownModel, WheelZoomHint, useViewerHint } from '../../viewer/ViewerParts';
import { useModelViewer } from '../../viewer/useModelViewer';
import { acceptedNodeIds, nodeIdsOf } from './scoring.mjs';

type PartPickerProps = {
  question: ModelClickQuestion;
  /** The node ids the tapped part answers to (its own id first), or undefined while nothing is tapped. */
  answer: string[] | undefined;
  onAnswer: (answer: string[]) => void;
  /** True once the answer is verified: tapping stops counting and the right part is shown. */
  revealed: boolean;
};

/**
 * The answer area of a model-click question: a 3D model the learner taps, and a list to choose from when the model cannot be used. The
 * model's own picking does the work: a tap selects a component (highlighting it), and the component's id and groups become the answer.
 * The part's name is never shown before Verify, so tapping around cannot find the answer by reading labels.
 */
export default function PartPicker({ question, answer, onAnswer, revealed }: PartPickerProps) {
  const definition = modelsById[question.modelId];
  const view = useMemo(() => ({ initialAngle: question.view?.initialAngle }), [question.view?.initialAngle]);
  const viewer = useModelViewer(question.modelId, lessonProfile(definition?.adapter), view);
  const hint = useViewerHint(viewer);
  const listId = useId();
  // What was chosen from the list. A tap on the model replaces it, so the list never shows the name of a part that was tapped.
  const [listChoice, setListChoice] = useState('');
  const components = viewer.features?.components;
  const selectedId = viewer.snapshot.selectedId;
  const label = (id?: string) => components?.items.find((item) => item.id === id)?.label ?? components?.groups.find((group) => group.id === id)?.label;

  // A tap (or a choice from the list) selects a component in the model; its ids are the answer until the answer is verified.
  useEffect(() => {
    if (revealed || !components || !selectedId) return;
    const ids = nodeIdsOf(components.items.find((item) => item.id === selectedId));
    if (ids.length && ids.join('|') !== (answer ?? []).join('|')) onAnswer(ids);
  }, [selectedId, components, revealed]);

  useEffect(() => { if (selectedId !== listChoice) setListChoice(''); }, [selectedId]);

  // Once verified, the right part is highlighted whatever was tapped.
  useEffect(() => {
    if (revealed && components && components.items.some((item) => item.id === question.correctNodeId)) components.select(question.correctNodeId);
  }, [revealed, components, question.correctNodeId]);

  if (!definition) return <UnknownModel modelId={question.modelId} />;
  const tapped = answer?.[0];
  const sorted = components ? [...components.items].sort((a, b) => a.label.localeCompare(b.label, 'en')) : [];

  return <div className="flex flex-col gap-2.5">
    <section className="overflow-hidden rounded-xl border border-teal-400/20 bg-[#071418]" aria-label={`Interactive 3D model of the ${definition.label}: tap the part`}>
      <div className="relative h-[min(58vh,22rem)]">
        <ModelCanvas viewer={viewer} />
        <div className="absolute right-1 top-1 z-10 flex items-center">
          <PanToggle viewer={viewer} />
          <ToolbarButton label="Reset and centre 3D view" onClick={viewer.resetView}><RotateCcw className="h-4 w-4" /></ToolbarButton>
        </div>
        <WheelZoomHint viewer={viewer} />
      </div>
      <p className="truncate border-t border-slate-800/80 px-3 py-2 text-[11px] text-slate-400">{hint}</p>
    </section>
    <p role="status" className="text-xs leading-snug text-slate-300">
      {revealed
        ? <>You tapped <strong className="text-white">{label(tapped) ?? 'no part'}</strong>. The right answer is <strong className="text-teal-200">{label(question.correctNodeId) ?? question.correctNodeId}</strong>{acceptedNodeIds(question).length > 1 ? ' (or another part that counts)' : ''}.</>
        : tapped
          ? 'A part is highlighted. Tap another to change your answer, then verify.'
          : 'Tap a part on the model to choose it. Drag to turn the model, pinch to zoom.'}
    </p>
    <details className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
      <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-slate-200">Cannot use the model? Choose the part from a list</summary>
      <label htmlFor={listId} className="mb-1.5 block text-xs font-semibold text-slate-300">Part</label>
      <select id={listId} disabled={revealed || !components} value={listChoice} onChange={(event) => { setListChoice(event.target.value); components?.select(event.target.value); }} className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-2.5 text-base text-slate-100 focus:border-teal-400 focus:outline-none disabled:opacity-80 sm:text-sm">
        <option value="">Choose a part…</option>
        {sorted.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </details>
  </div>;
}
