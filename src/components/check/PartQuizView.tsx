import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { ChevronLeft, RotateCcw, Trophy } from 'lucide-react';
import type { ModelDefinition } from '../../data/modelRegistry';
import { lessonProfile } from '../../viewer/core/view-state.mjs';
import { useModelViewer } from '../../viewer/useModelViewer';
import { ProgressNavigator, type ProgressItem } from '../ProgressNavigator';
import { PartPickerBody } from './PartPicker';
import { QuestionFoot, QuestionHead } from './QuestionCard';
import { buildPartFacts } from './partFacts';
import { MIN_QUESTIONS, ROUND_SIZE, buildPartQuiz, seededRandom } from './part-quiz.mjs';
import { isAnswered, isCorrect } from './scoring.mjs';

type PartQuizViewProps = {
  model: ModelDefinition;
  onExit: () => void;
  /** Called once when a round's last question is answered. */
  onFinish: (modelId: string, score: number, total: number) => void;
};

const NO_VIEW = {};
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * A 3D part quiz for one model, made on the spot from the part data that model already has (see part-quiz.mjs): the questions are not
 * written anywhere, so any model with named parts has a quiz. One model stays loaded for the whole round, each round draws different
 * questions, and a learner can hide parts to uncover what is inside.
 */
export default function PartQuizView({ model, onExit, onFinish }: PartQuizViewProps) {
  const viewer = useModelViewer(model.id, lessonProfile(model.adapter), NO_VIEW);
  const components = viewer.features?.components;
  const [seed, setSeed] = useState(newSeed);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  // What the model's data says about each part. The geometry is measured once it has loaded, so tiny parts are not asked about and the
  // parts that sit inside others are known to need uncovering.
  const facts = useMemo(() => (components ? buildPartFacts(components.items, components.groups, components.boxes?.() ?? []) : []), [components]);
  const deck = useMemo(() => (facts.length ? buildPartQuiz(model.id, facts, { count: ROUND_SIZE, random: seededRandom(seed) }) : []), [facts, model.id, seed]);
  const total = deck.length;
  const tooFew = Boolean(components) && total < MIN_QUESTIONS;
  const finished = total > 0 && index >= total;
  const current = deck[index];
  const score = deck.reduce((sum, question, at) => sum + (submitted[at] && isCorrect(question, answers[at]) ? 1 : 0), 0);

  useEffect(() => { if (finished) onFinish(model.id, score, total); }, [finished]);

  // A new question starts from the whole model: nothing hidden, nothing chosen, nothing spotlit.
  const resetStage = () => components?.showAll();
  const goTo = (at: number) => { resetStage(); setIndex(at); };
  const verify = () => {
    if (!current || !isAnswered(current, answers[index])) return;
    setSubmitted((previous) => ({ ...previous, [index]: true }));
    if (isCorrect(current, answers[index])) confetti({ particleCount: 45, spread: 55, origin: { y: 0.72 }, colors: ['#2dd4bf', '#22c55e', '#38bdf8'] });
  };
  const newRound = () => {
    resetStage();
    setSeed(newSeed());
    setIndex(0);
    setAnswers({});
    setSubmitted({});
  };

  const missed = deck.filter((question, at) => submitted[at] && !isCorrect(question, answers[at])).map((question) => question.generated?.answer ?? question.question);

  return <div className="relative h-full w-full overflow-y-auto bg-canvas pb-24 text-slate-100">
    <div className="mx-auto w-full max-w-xl px-4 pt-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onExit} className="-my-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-teal-400 hover:bg-slate-800/60"><ChevronLeft className="h-4 w-4" />Assessments</button>
        <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-1 font-mono text-xs font-semibold text-teal-300">{score} / {total || ROUND_SIZE}</span>
      </div>
      <p className="mt-3 font-mono text-[11px] font-bold tracking-wider text-teal-400">3D PART QUIZ</p>
      <h2 className="line-clamp-2 text-xl font-bold text-white">{model.shortLabel}</h2>
    </div>
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-3">
      {total > 0 && <ProgressNavigator
        noun="question"
        heading="Questions in this round"
        currentIndex={Math.min(index, total - 1)}
        onSelect={goTo}
        items={deck.map((question, at): ProgressItem => ({ id: question.id, title: question.question, state: submitted[at] ? (isCorrect(question, answers[at]) ? 'correct' : 'wrong') : 'todo' }))}
        summary={<><span className="text-white">{finished ? 'Round complete' : `Question ${index + 1} of ${total}`}</span><span className="ml-auto font-mono text-[11px] text-slate-400">{Object.keys(submitted).length} answered</span></>}
      />}
      <section className="flex flex-col gap-4 rounded-2xl border border-teal-500/30 bg-panel p-5 shadow-xl">
        {finished && <div className="flex flex-col gap-3 rounded-xl border border-teal-500/40 bg-teal-950/40 p-4 text-xs leading-relaxed text-teal-100">
          <strong className="flex items-center gap-2 font-mono tracking-wide"><Trophy className="h-4 w-4" aria-hidden="true" />ROUND COMPLETE</strong>
          <p className="text-sm font-semibold text-white">You found {score} of {total}.</p>
          {missed.length > 0 && <p>To look at again: {missed.join(', ')}.</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={newRound} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-400 px-3 text-xs font-bold text-slate-950"><RotateCcw className="h-4 w-4" aria-hidden="true" />New round, new questions</button>
            <button type="button" onClick={onExit} className="min-h-11 flex-1 rounded-xl border border-slate-600 px-3 text-xs font-semibold text-slate-200">Back to assessments</button>
          </div>
        </div>}
        {current && <QuestionHead question={current} />}
        {!components && !viewer.error && <p role="status" className="text-xs text-slate-300">Loading the model. Your questions are made from its parts.</p>}
        {tooFew && <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100">This model does not have enough named parts for a quiz yet.</p>}
        <PartPickerBody
          viewer={viewer}
          question={current}
          answer={answers[index]}
          onAnswer={(answer) => setAnswers((previous) => ({ ...previous, [index]: answer }))}
          revealed={Boolean(submitted[index])}
          tall
        />
        {current && <QuestionFoot question={current} answer={answers[index]} revealed={Boolean(submitted[index])} onVerify={verify} onNext={() => goTo(index + 1)} isLast={index === total - 1} finishLabel="See your result" />}
      </section>
      {total > 0 && !finished && <button type="button" onClick={newRound} className="-mt-2 ml-auto flex min-h-11 items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300"><RotateCcw className="h-3.5 w-3.5" />New round</button>}
    </div>
  </div>;
}
