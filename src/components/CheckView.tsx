import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Award, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, FileQuestion, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import type { QuizModule, QuizQuestion } from '../types/engine';
import { VisualIllustration } from './VisualIllustrations';
import { CardImage, CardRow, IconButton } from './ui';
import { ProgressNavigator, type ProgressItem } from './ProgressNavigator';

interface CheckViewProps { modules: QuizModule[]; focusLessonId?: string }
type Answer = number | string[];

const shuffled = (items: string[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  if (next.length > 1 && next.every((item, index) => item === items[index])) [next[0], next[1]] = [next[1], next[0]];
  return next;
};

const isCorrectAnswer = (question: QuizQuestion, answer?: Answer) => {
  if (question.type !== 'ordering') return answer === question.correctIndex;
  if (!Array.isArray(answer)) return false;
  return answer.every((item, index) => item === question.items?.[index]);
};

export const CheckView: React.FC<CheckViewProps> = ({ modules, focusLessonId }) => {
  const [activeModule, setActiveModule] = useState<QuizModule | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const current = activeModule?.questions[questionIndex];
  const total = activeModule?.questions.length || 0;
  const score = useMemo(
    () => activeModule?.questions.reduce((sum, question, index) => sum + (submitted[index] && isCorrectAnswer(question, answers[index]) ? 1 : 0), 0) || 0,
    [activeModule, answers, submitted],
  );

  useEffect(() => {
    if (!focusLessonId) return;
    const sourceModule = modules.find((module) => module.questions.some((question) => question.lessonId === focusLessonId));
    if (!sourceModule) return;
    const questions = sourceModule.questions.filter((question) => question.lessonId === focusLessonId);
    const initial: Record<number, Answer> = {};
    questions.forEach((question, index) => {
      if (question.type === 'ordering') initial[index] = shuffled(question.items || []);
    });
    setActiveModule({ ...sourceModule, id: `${sourceModule.id}:${focusLessonId}`, title: 'Lesson knowledge check', subtitle: sourceModule.title, questions, questionCount: questions.length });
    setQuestionIndex(0);
    setAnswers(initial);
    setSubmitted({});
  }, [focusLessonId, modules]);

  const start = (module: QuizModule) => {
    const initial: Record<number, Answer> = {};
    module.questions.forEach((question, index) => {
      if (question.type === 'ordering') initial[index] = shuffled(question.items || []);
    });
    setActiveModule(module);
    setQuestionIndex(0);
    setAnswers(initial);
    setSubmitted({});
  };

  const submit = () => {
    if (!current || answers[questionIndex] === undefined) return;
    setSubmitted((previous) => ({ ...previous, [questionIndex]: true }));
    const correct = isCorrectAnswer(current, answers[questionIndex]);
    if (activeModule) setBestScores((previous) => ({ ...previous, [activeModule.id]: Math.max(previous[activeModule.id] || 0, score + (correct ? 1 : 0)) }));
    if (correct) confetti({ particleCount: 45, spread: 55, origin: { y: 0.72 }, colors: ['#2dd4bf', '#22c55e', '#38bdf8'] });
  };

  const moveItem = (from: number, direction: -1 | 1) => {
    if (submitted[questionIndex] || !Array.isArray(answers[questionIndex])) return;
    const order = [...(answers[questionIndex] as string[])];
    const to = from + direction;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    setAnswers((previous) => ({ ...previous, [questionIndex]: order }));
  };

  if (!activeModule) {
    return <div className="relative h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-4 pt-4">
        <section className="relative overflow-hidden rounded-2xl border border-teal-500/35 bg-gradient-to-br from-[#081a20] via-[#07171d] to-[#040e13] p-4 shadow-xl shadow-black/40 sm:p-5">
          <div className="flex items-center gap-2 text-teal-300"><Award className="h-4 w-4" /><span className="font-mono text-[11px] font-bold tracking-wider">CHECK MODE · PUBLISHED ASSESSMENTS</span></div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div><h2 className="text-2xl font-bold text-white">Knowledge checks</h2><p className="mt-1 text-xs leading-relaxed text-slate-300">Work through the checks shipped with each lesson pack. Answers and rationales come from the same validated curriculum files as Learn mode.</p>
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]"><span className="rounded-md border border-teal-500/30 bg-teal-950/40 px-2.5 py-1 text-teal-300"><FileQuestion className="mr-1 inline h-3.5 w-3.5" />{modules.length} assessment tracks</span><span className="rounded-md border border-slate-700/60 bg-slate-900/70 px-2.5 py-1 text-slate-300"><Sparkles className="mr-1 inline h-3.5 w-3.5" />Evidence-backed feedback</span></div>
            </div>
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-teal-500/20"><VisualIllustration type="gauges" className="h-full w-full" /></div>
          </div>
        </section>
        <div className="flex items-center justify-between"><h3 className="font-bold text-white">Assessment modules</h3><span className="font-mono text-xs text-slate-400">{modules.reduce((sum, module) => sum + module.questionCount, 0)} questions</span></div>
        <div className="flex flex-col gap-2.5">{modules.map((module) => <CardRow key={module.id} onClick={() => start(module)} image={<CardImage src={module.thumbnail} fallbackType={module.imageType} />}><div className="flex flex-wrap items-center gap-2"><span className="rounded-md border border-teal-500/30 bg-teal-950/40 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-400">{module.badge}</span>{bestScores[module.id] !== undefined && <span className="font-mono text-[11px] font-bold text-emerald-400">Best {bestScores[module.id]}/{module.questionCount}</span>}</div><h4 className="mt-1 truncate text-sm font-bold text-white transition group-hover:text-teal-300 sm:text-base">{module.title}</h4><p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-300">{module.subtitle}</p><div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-slate-400"><span><FileQuestion className="mr-1 inline h-3 w-3 text-teal-400" />{module.questionCount} questions</span><span><Clock className="mr-1 inline h-3 w-3" />{module.approxMinutes}</span></div></CardRow>)}</div>
      </div>
    </div>;
  }

  if (!current) return null;
  const answer = answers[questionIndex];
  const wasSubmitted = submitted[questionIndex];
  const correct = isCorrectAnswer(current, answer);

  return <div className="relative h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
    <div className="mx-auto w-full max-w-xl px-4 pt-3"><div className="flex items-center justify-between"><button onClick={() => setActiveModule(null)} className="-my-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-teal-400 hover:bg-slate-800/60"><ChevronLeft className="h-4 w-4" />Assessments</button><span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-1 font-mono text-xs font-semibold text-teal-300">{score} / {total}</span></div><h2 className="mt-3 truncate text-xl font-bold text-white">{activeModule.title}</h2></div>
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-3">
      <ProgressNavigator
        noun="question"
        heading="Questions in this check"
        currentIndex={questionIndex}
        onSelect={setQuestionIndex}
        items={activeModule.questions.map((question, index): ProgressItem => ({ id: question.id, title: question.question, state: submitted[index] ? (isCorrectAnswer(question, answers[index]) ? 'correct' : 'wrong') : 'todo' }))}
        summary={<><span className="text-white">Question {questionIndex + 1} of {total}</span><span className="ml-auto font-mono text-[11px] text-slate-400">{activeModule.questions.filter((_, index) => submitted[index]).length} answered</span></>}
      />
      <section className="flex flex-col gap-4 rounded-2xl border border-teal-500/30 bg-[#08181e] p-5 shadow-xl">
        <div className="flex items-center justify-between font-mono text-xs"><span className="font-bold tracking-wider text-teal-400">{current.type === 'ordering' ? 'ORDER THE ITEMS' : 'SELECT ONE ANSWER'}</span><span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] uppercase text-slate-400">{current.category}</span></div>
        <h3 className="text-base font-bold leading-snug text-white sm:text-lg">{current.question}</h3>
        {current.hint && <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100"><Lightbulb className="h-4 w-4 shrink-0 text-amber-300" />{current.hint}</div>}
        {current.type === 'multiple-choice' ? <div className="flex flex-col gap-2.5">{current.options.map((option, index) => {
          const selected = answer === index;
          const expected = index === current.correctIndex;
          const style = wasSubmitted ? (expected ? 'border-teal-400 bg-teal-950/60 text-teal-100' : selected ? 'border-rose-500 bg-rose-950/50 text-rose-100' : 'border-slate-800 bg-slate-900/30 text-slate-400') : selected ? 'border-teal-400 bg-teal-500/20 text-teal-200' : 'border-slate-700/60 bg-slate-900/60 text-slate-200 hover:border-slate-500';
          return <button key={option} disabled={wasSubmitted} onClick={() => setAnswers((previous) => ({ ...previous, [questionIndex]: index }))} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs transition sm:text-sm ${style}`}><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-800 font-mono text-xs font-bold">{String.fromCharCode(65 + index)}</span><span>{option}</span></button>;
        })}</div> : <ol className="flex flex-col gap-2">{(Array.isArray(answer) ? answer : []).map((item, index, order) => <li key={item} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-xs sm:text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-950 font-mono font-bold text-teal-300">{index + 1}</span><span className="flex-1">{item}</span><div className="flex gap-1"><IconButton size="sm" shape="soft" disabled={wasSubmitted || index === 0} onClick={() => moveItem(index, -1)} label={`Move ${item} up`} className="-my-2 disabled:opacity-25"><ChevronUp className="h-4 w-4" /></IconButton><IconButton size="sm" shape="soft" disabled={wasSubmitted || index === order.length - 1} onClick={() => moveItem(index, 1)} label={`Move ${item} down`} className="-my-2 -mr-2 disabled:opacity-25"><ChevronDown className="h-4 w-4" /></IconButton></div></li>)}</ol>}
        {!wasSubmitted ? <button disabled={answer === undefined} onClick={submit} className="min-h-11 w-full rounded-xl bg-teal-400 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-teal-400/20 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400">Verify answer</button> : <div className="flex flex-col gap-3 border-t border-slate-800 pt-3"><div className={`rounded-xl border p-3.5 text-xs leading-relaxed ${correct ? 'border-teal-500/40 bg-teal-950/40 text-teal-100' : 'border-rose-500/40 bg-rose-950/35 text-rose-100'}`}><strong className="mb-1 block font-mono tracking-wide">{correct ? 'CORRECT — WHY IT MATTERS' : 'REVIEW THE EVIDENCE'}</strong>{current.explanation}</div><button onClick={() => questionIndex < total - 1 ? setQuestionIndex(questionIndex + 1) : setActiveModule(null)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-400 py-3 text-xs font-bold text-slate-950">{questionIndex < total - 1 ? 'Next question' : 'Finish assessment'}<ChevronRight className="h-4 w-4" /></button></div>}
      </section>
      <button onClick={() => start(activeModule)} className="-mt-2 ml-auto flex min-h-11 items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300"><RotateCcw className="h-3.5 w-3.5" />Restart assessment</button>
    </div>
  </div>;
};
