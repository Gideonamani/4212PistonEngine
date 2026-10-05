import React, { useId } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Lightbulb } from 'lucide-react';
import type { QuizQuestion } from '../../types/engine';
import { IconButton } from '../ui';
import { describeNumericAnswer, isAnswered, isCorrect, matchingOptions, matchingResults, parseNumber } from './scoring.mjs';

/** What the learner has entered so far: an option index, an item order, the chosen right-hand text per term, or typed text. */
export type Answer = number | string | string[];

type QuestionCardProps = {
  question: QuizQuestion;
  /** For a multiple-choice question, the order its options are shown in, as indexes into question.options; the pack order when absent. */
  optionOrder?: number[];
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  /** True once the answer is verified: the answer area locks and the explanation shows. */
  revealed: boolean;
  onVerify: () => void;
  onNext: () => void;
  isLast: boolean;
};

const typeLabel: Record<QuizQuestion['type'], string> = {
  'multiple-choice': 'SELECT ONE ANSWER',
  ordering: 'ORDER THE ITEMS',
  matching: 'MATCH EACH ITEM',
  numeric: 'ENTER A NUMBER',
};

type AnswerProps<T extends QuizQuestion> = { question: T; answer: Answer | undefined; onAnswer: (answer: Answer) => void; revealed: boolean; onVerify: () => void; optionOrder?: number[] };

const ChoiceAnswer: React.FC<AnswerProps<Extract<QuizQuestion, { type: 'multiple-choice' }>>> = ({ question, answer, onAnswer, revealed, optionOrder }) => (
  <div className="flex flex-col gap-2.5">{(optionOrder ?? question.options.map((_, index) => index)).map((original, position) => {
    const option = question.options[original];
    const selected = answer === original;
    const expected = original === question.correctIndex;
    const style = revealed ? (expected ? 'border-teal-400 bg-teal-950/60 text-teal-100' : selected ? 'border-rose-500 bg-rose-950/50 text-rose-100' : 'border-slate-800 bg-slate-900/30 text-slate-400') : selected ? 'border-teal-400 bg-teal-500/20 text-teal-200' : 'border-slate-700/60 bg-slate-900/60 text-slate-200 hover:border-slate-500';
    return <button key={option} disabled={revealed} onClick={() => onAnswer(original)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs transition sm:text-sm ${style}`}><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-800 font-mono text-xs font-bold">{String.fromCharCode(65 + position)}</span><span>{option}</span></button>;
  })}</div>
);

const OrderingAnswer: React.FC<AnswerProps<Extract<QuizQuestion, { type: 'ordering' }>>> = ({ answer, onAnswer, revealed }) => {
  const order = Array.isArray(answer) ? answer : [];
  const move = (from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (revealed || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    onAnswer(next);
  };
  return <ol className="flex flex-col gap-2">{order.map((item, index) => <li key={item} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-xs sm:text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-950 font-mono font-bold text-teal-300">{index + 1}</span><span className="flex-1">{item}</span><div className="flex gap-1"><IconButton size="sm" shape="soft" disabled={revealed || index === 0} onClick={() => move(index, -1)} label={`Move ${item} up`} className="-my-2 disabled:opacity-25"><ChevronUp className="h-4 w-4" /></IconButton><IconButton size="sm" shape="soft" disabled={revealed || index === order.length - 1} onClick={() => move(index, 1)} label={`Move ${item} down`} className="-my-2 -mr-2 disabled:opacity-25"><ChevronDown className="h-4 w-4" /></IconButton></div></li>)}</ol>;
};

const MatchingAnswer: React.FC<AnswerProps<Extract<QuizQuestion, { type: 'matching' }>>> = ({ question, answer, onAnswer, revealed }) => {
  const baseId = useId();
  const chosen = Array.isArray(answer) ? answer : [];
  const options = matchingOptions(question);
  const results = matchingResults(question, answer);
  const choose = (index: number, value: string) => {
    const next = question.pairs.map((_, position) => chosen[position] || '');
    next[index] = value;
    onAnswer(next);
  };
  return <ul className="flex flex-col gap-2.5">{question.pairs.map((pair, index) => {
    const id = `${baseId}-${index}`;
    const tone = revealed ? (results[index] ? 'border-teal-400 bg-teal-950/60' : 'border-rose-500 bg-rose-950/50') : 'border-slate-700/60 bg-slate-900/60';
    return <li key={pair.left} className={`flex flex-col gap-2 rounded-xl border p-3 ${tone}`}>
      <label htmlFor={id} className="text-xs font-semibold leading-snug text-slate-100 sm:text-sm">{pair.left}</label>
      <select id={id} disabled={revealed} value={chosen[index] || ''} onChange={(event) => choose(index, event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-2.5 text-base text-slate-100 focus:border-teal-400 focus:outline-none disabled:opacity-80 sm:text-sm">
        <option value="">Choose a match…</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {revealed && !results[index] && <p className="text-[11px] leading-snug text-teal-200">Correct match: {pair.right}</p>}
    </li>;
  })}</ul>;
};

const NumericAnswer: React.FC<AnswerProps<Extract<QuizQuestion, { type: 'numeric' }>>> = ({ question, answer, onAnswer, revealed, onVerify }) => {
  const id = useId();
  const typed = typeof answer === 'string' ? answer : '';
  const tone = revealed ? (isCorrect(question, answer) ? 'border-teal-400' : 'border-rose-500') : 'border-slate-600 focus-within:border-teal-400';
  return <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-xs font-semibold text-slate-300">Your answer, in {question.unit}</label>
    <div className={`flex items-stretch overflow-hidden rounded-xl border bg-slate-950/70 ${tone}`}>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false} disabled={revealed} value={typed} placeholder="Type a number" onChange={(event) => onAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && parseNumber(typed) !== null && !revealed) onVerify(); }} className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-white placeholder:text-slate-400 focus:outline-none sm:text-sm" />
      <span className="flex items-center border-l border-slate-700 bg-slate-900 px-3 font-mono text-xs text-slate-300">{question.unit}</span>
    </div>
    {typed.trim() !== '' && parseNumber(typed) === null && !revealed && <p role="status" className="text-[11px] text-amber-200">Enter a number, for example 78.5 or 33,000.</p>}
  </div>;
};

/** One Check question: its prompt and hint, the answer area for its type, then Verify, and after Verify the explanation and the way on. */
export const QuestionCard: React.FC<QuestionCardProps> = ({ question, optionOrder, answer, onAnswer, revealed, onVerify, onNext, isLast }) => {
  const correct = isCorrect(question, answer);
  const props = { answer, onAnswer, revealed, onVerify };
  return <section className="flex flex-col gap-4 rounded-2xl border border-teal-500/30 bg-[#08181e] p-5 shadow-xl">
    <div className="flex items-center justify-between font-mono text-xs"><span className="font-bold tracking-wider text-teal-400">{typeLabel[question.type]}</span></div>
    <h3 className="text-base font-bold leading-snug text-white sm:text-lg">{question.question}</h3>
    {question.hint && <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100"><Lightbulb className="h-4 w-4 shrink-0 text-amber-300" />{question.hint}</div>}
    {question.type === 'multiple-choice' && <ChoiceAnswer question={question} optionOrder={optionOrder} {...props} />}
    {question.type === 'ordering' && <OrderingAnswer question={question} {...props} />}
    {question.type === 'matching' && <MatchingAnswer question={question} {...props} />}
    {question.type === 'numeric' && <NumericAnswer question={question} {...props} />}
    {!revealed
      ? <button disabled={!isAnswered(question, answer)} onClick={onVerify} className="min-h-11 w-full rounded-xl bg-teal-400 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-teal-400/20 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400">Verify answer</button>
      : <div className="flex flex-col gap-3 border-t border-slate-800 pt-3">
        <div className={`rounded-xl border p-3.5 text-xs leading-relaxed ${correct ? 'border-teal-500/40 bg-teal-950/40 text-teal-100' : 'border-rose-500/40 bg-rose-950/35 text-rose-100'}`}>
          <strong className="mb-1 block font-mono tracking-wide">{correct ? 'CORRECT — WHY IT MATTERS' : 'REVIEW THE EVIDENCE'}</strong>
          {question.type === 'numeric' && <p className="mb-1.5 font-semibold">{correct ? 'Your answer: ' : 'The answer is '}{correct ? `${answer} ${question.unit}` : describeNumericAnswer(question)}{!correct && <span className="font-normal"> (you entered {String(answer)} {question.unit})</span>}</p>}
          {question.explanation}
        </div>
        <button onClick={onNext} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-400 py-3 text-xs font-bold text-slate-950">{isLast ? 'Finish assessment' : 'Next question'}<ChevronRight className="h-4 w-4" /></button>
      </div>}
  </section>;
};
