import React, { useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { modelsById } from '../../data/modelRegistry';
import type { NamePartQuestion } from '../../types/engine';
import { lessonProfile } from '../../viewer/core/view-state.mjs';
import { ModelCanvas, PanToggle, ToolbarButton, UnknownModel, WheelZoomHint, useViewerHint } from '../../viewer/ViewerParts';
import { useModelViewer } from '../../viewer/useModelViewer';

type PartShowcaseProps = {
  question: NamePartQuestion;
};

/**
 * The model of a name-part question: the part to name is spotlit in X-ray, so it shows even inside the cylinder, and the camera closes in on
 * it as Explore does, so a small part is more than a few pixels. The learner may turn and zoom the model. Nothing here names the part, not
 * even the region's label for a screen reader: the name has to come from the learner, who picks it from the answers under the model.
 */
export default function PartShowcase({ question }: PartShowcaseProps) {
  const definition = modelsById[question.modelId];
  const view = useMemo(() => ({ initialAngle: question.view?.initialAngle, focusParts: [question.partId], focusMode: 'xray' as const }), [question.view?.initialAngle, question.partId]);
  const viewer = useModelViewer(question.modelId, lessonProfile(definition?.adapter), view);
  const hint = useViewerHint(viewer);
  const focus = viewer.features?.focus;
  const showPart = () => focus?.set([question.partId], 'xray', { closeUp: true });

  useEffect(() => { showPart(); }, [focus, question.partId]);

  if (!definition) return <UnknownModel modelId={question.modelId} />;
  return <section className="overflow-hidden rounded-xl border border-teal-400/20 bg-stage" aria-label={`Interactive 3D model of the ${definition.label}, with one part highlighted`}>
    <div className="relative h-[min(58vh,22rem)]">
      <ModelCanvas viewer={viewer} />
      <div className="absolute right-1 top-1 z-10 flex items-center">
        <PanToggle viewer={viewer} />
        <ToolbarButton label="Back to the highlighted part" onClick={showPart}><RotateCcw className="h-4 w-4" /></ToolbarButton>
      </div>
      <WheelZoomHint viewer={viewer} />
    </div>
    <p className="truncate border-t border-slate-800/80 px-3 py-2 text-[11px] text-slate-400">{hint}</p>
  </section>;
}
