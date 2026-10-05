import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Award, ChevronLeft, Clock, FileQuestion, RotateCcw, Sparkles } from 'lucide-react';
import type { QuizModule, QuizQuestion } from '../types/engine';
import { CardImage, CardRow } from './ui';
import { ProgressNavigator, type ProgressItem } from './ProgressNavigator';
import { QuestionCard, type Answer } from './check/QuestionCard';
import { initialAnswer, isAnswered, isCorrect } from './check/scoring.mjs';

interface CheckViewProps { modules: QuizModule[]; focusLessonId?: string }

const startingAnswers = (questions: QuizQuestion[]) => {
  const initial: Record<number, Answer> = {};
  questions.forEach((question, index) => {
    const answer = initialAnswer(question) as Answer | undefined;
    if (answer !== undefined) initial[index] = answer;
  });
  return initial;
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
    () => activeModule?.questions.reduce((sum, question, index) => sum + (submitted[index] && isCorrect(question, answers[index]) ? 1 : 0), 0) || 0,
    [activeModule, answers, submitted],
  );

  useEffect(() => {
    if (!focusLessonId) return;
    const sourceModule = modules.find((module) => module.questions.some((question) => question.lessonId === focusLessonId));
    if (!sourceModule) return;
    const questions = sourceModule.questions.filter((question) => question.lessonId === focusLessonId);
    setActiveModule({ ...sourceModule, id: `${sourceModule.id}:${focusLessonId}`, title: 'Lesson knowledge check', subtitle: sourceModule.title, questions, questionCount: questions.length });
    setQuestionIndex(0);
    setAnswers(startingAnswers(questions));
    setSubmitted({});
  }, [focusLessonId, modules]);

  const start = (module: QuizModule) => {
    setActiveModule(module);
    setQuestionIndex(0);
    setAnswers(startingAnswers(module.questions));
    setSubmitted({});
  };

  const submit = () => {
    if (!current || !isAnswered(current, answers[questionIndex])) return;
    setSubmitted((previous) => ({ ...previous, [questionIndex]: true }));
    const correct = isCorrect(current, answers[questionIndex]);
    if (activeModule) setBestScores((previous) => ({ ...previous, [activeModule.id]: Math.max(previous[activeModule.id] || 0, score + (correct ? 1 : 0)) }));
    if (correct) confetti({ particleCount: 45, spread: 55, origin: { y: 0.72 }, colors: ['#2dd4bf', '#22c55e', '#38bdf8'] });
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
          </div>
        </section>
        <div className="flex items-center justify-between"><h3 className="font-bold text-white">Assessment modules</h3><span className="font-mono text-xs text-slate-400">{modules.reduce((sum, module) => sum + module.questionCount, 0)} questions</span></div>
        <div className="flex flex-col gap-2.5">{modules.map((module) => <CardRow key={module.id} onClick={() => start(module)} image={<CardImage src={module.thumbnail} />}>{bestScores[module.id] !== undefined && <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] font-bold text-emerald-400">Best {bestScores[module.id]}/{module.questionCount}</span></div>}<h4 className="mt-1 truncate text-sm font-bold text-white transition group-hover:text-teal-300 sm:text-base">{module.title}</h4><p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-300">{module.subtitle}</p><div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-slate-400"><span><FileQuestion className="mr-1 inline h-3 w-3 text-teal-400" />{module.questionCount} questions</span><span><Clock className="mr-1 inline h-3 w-3" />{module.approxMinutes}</span></div></CardRow>)}</div>
      </div>
    </div>;
  }

  if (!current) return null;

  return <div className="relative h-full w-full overflow-y-auto bg-[#061014] pb-24 text-slate-100">
    <div className="mx-auto w-full max-w-xl px-4 pt-3"><div className="flex items-center justify-between"><button onClick={() => setActiveModule(null)} className="-my-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-teal-400 hover:bg-slate-800/60"><ChevronLeft className="h-4 w-4" />Assessments</button><span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-1 font-mono text-xs font-semibold text-teal-300">{score} / {total}</span></div><h2 className="mt-3 truncate text-xl font-bold text-white">{activeModule.title}</h2></div>
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-3">
      <ProgressNavigator
        noun="question"
        heading="Questions in this check"
        currentIndex={questionIndex}
        onSelect={setQuestionIndex}
        items={activeModule.questions.map((question, index): ProgressItem => ({ id: question.id, title: question.question, state: submitted[index] ? (isCorrect(question, answers[index]) ? 'correct' : 'wrong') : 'todo' }))}
        summary={<><span className="text-white">Question {questionIndex + 1} of {total}</span><span className="ml-auto font-mono text-[11px] text-slate-400">{activeModule.questions.filter((_, index) => submitted[index]).length} answered</span></>}
      />
      <QuestionCard
        key={current.id}
        question={current}
        answer={answers[questionIndex]}
        onAnswer={(answer) => setAnswers((previous) => ({ ...previous, [questionIndex]: answer }))}
        revealed={Boolean(submitted[questionIndex])}
        onVerify={submit}
        onNext={() => questionIndex < total - 1 ? setQuestionIndex(questionIndex + 1) : setActiveModule(null)}
        isLast={questionIndex === total - 1}
      />
      <button onClick={() => start(activeModule)} className="-mt-2 ml-auto flex min-h-11 items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300"><RotateCcw className="h-3.5 w-3.5" />Restart assessment</button>
    </div>
  </div>;
};
