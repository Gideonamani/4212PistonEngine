import React, { Suspense } from 'react';
import { Construction, ExternalLink } from 'lucide-react';
import { LessonStep } from '../types/engine';
import { LessonArtifact } from './LessonArtifacts';
import { modelsById } from '../data/modelRegistry';

import { viewFromStep } from '../viewer/core/view-state.mjs';

const LessonViewer = React.lazy(() => import('../viewer/LessonViewer'));

interface LessonMediaProps {
  step: LessonStep;
  immersive?: boolean;
}

const isWebUrl = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

const isPlannedStep = (step: LessonStep) => step.mediaPlan?.status === 'planned' || (step.url || '').startsWith('PLACEHOLDER:');

/** A step whose media is the live 3D viewer; rendered by LessonModelStage so the loaded model survives step changes. */
export const isModelStep = (step: LessonStep) => step.mediaPlan?.mode !== 'none' && !isPlannedStep(step) && !(step.url || '').startsWith('artifact:')
  && step.type === 'model-pose' && Boolean(step.modelId && modelsById[step.modelId]);

/**
 * Whether a step has any media to show above its text: the 3D viewer, a planned-media notice, a native interactive, a picture or an
 * embedded page. A plain text step has none, and the layout gives it no media slot at all rather than an empty panel.
 */
export const stepHasMedia = (step: LessonStep) => {
  if (step.mediaPlan?.mode === 'none') return false;
  const url = step.url || '';
  return isPlannedStep(step) || url.startsWith('artifact:') || isModelStep(step)
    || (step.type === 'image' && Boolean(url)) || (step.type === 'web-embed' && isWebUrl(url));
};

/**
 * The lesson's 3D viewer. It stays mounted (hidden) while the learner passes text or image steps, and each model step only
 * changes the pose and spotlight, so the model is not rebuilt until the lesson switches to a different model.
 */
export const LessonModelStage: React.FC<{ step: LessonStep; active: boolean; immersive?: boolean; layout?: 'stacked' | 'side'; onSwitchTo3DModel?: (modelName: string) => void }> = ({ step, active, immersive = false, layout = 'stacked', onSwitchTo3DModel }) => {
  const definition = modelsById[step.modelId!];
  const view = viewFromStep(step);
  const side = layout === 'side';
  return <div hidden={!active} className={side ? 'h-full' : ''}><Suspense fallback={<div className={`flex items-center justify-center rounded-xl border border-teal-400/20 bg-[#071418] text-xs text-teal-300 ${side ? 'h-full' : 'h-80'}`}>Preparing interactive 3D viewer…</div>}>
    <LessonViewer modelId={step.modelId!} view={view} immersive={immersive} layout={layout} onOpenExplore={() => onSwitchTo3DModel?.(definition.label)} />
  </Suspense></div>;
};

/** A step picture. It holds a minimum height until it has loaded so the text below does not jump when it arrives. */
const StepImage: React.FC<{ src: string; alt: string; immersive: boolean }> = ({ src, alt, immersive }) => {
  const [loaded, setLoaded] = React.useState(false);
  return <img src={src} alt={alt} decoding="async" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} className={`w-full object-contain ${immersive ? 'max-h-[58dvh]' : 'max-h-80'} ${loaded ? '' : 'min-h-48'}`} />;
};

export const LessonMedia: React.FC<LessonMediaProps> = ({ step, immersive = false }) => {
  const url = step.url || '';
  const isPlanned = step.mediaPlan?.status === 'planned' || url.startsWith('PLACEHOLDER:');
  const artifactId = url.startsWith('artifact:') ? url.slice('artifact:'.length) : '';

  if (step.mediaPlan?.mode === 'none') return null;

  if (isPlanned) return <div className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-white/5 bg-gradient-to-br from-[#0b2429] to-[#071317] px-6 text-center shadow-inner">
    <Construction className="h-7 w-7 text-teal-400" />
    <span className="mt-2 font-mono text-[11px] font-bold tracking-widest text-teal-300">PLANNED LEARNING MEDIA</span>
    <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-300">{step.mediaPlan?.assetBrief || step.mediaPlan?.rationale || 'This activity is awaiting its published media asset.'}</p>
  </div>;

  if (artifactId) return <LessonArtifact id={artifactId} />;

  if (isModelStep(step)) return null;

  if (step.type === 'image' && url) return <figure className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/60 shadow-inner">
    <StepImage src={url} alt={step.alt || step.title} immersive={immersive} />
    {(step.credit || step.license) && <figcaption className="border-t border-slate-800 px-3 py-2 text-[11px] leading-relaxed text-slate-400">{step.credit}{step.credit && step.license ? ' · ' : ''}{step.license}</figcaption>}
  </figure>;

  if (step.type === 'web-embed' && isWebUrl(url)) return <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/60">
    <iframe src={url} title={step.alt || step.title} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms" className={`w-full ${immersive ? 'h-[58dvh]' : 'h-80'}`} />
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-t border-slate-800 px-3 py-2 text-xs font-semibold text-teal-300 hover:text-teal-200">Open in a new tab <ExternalLink className="h-3.5 w-3.5" /></a>
  </div>;

  return null;
};
