import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import type { LessonStep } from '../../types/engine';

/** The optional "think about it" box under a step: a question, a place to write, and the instructor's suggested answer on request. */
export const GuidedPrompt: React.FC<{
  step: LessonStep;
  answer: string;
  onAnswerChange: (value: string) => void;
  showInsight: boolean;
  onToggleInsight: () => void;
}> = ({ step, answer, onAnswerChange, showInsight, onToggleInsight }) => {
  if (!step.promptQuestion) return null;
  return <div className="p-3.5 rounded-xl bg-[#061418] border border-teal-500/30 flex flex-col gap-2.5">
    <div className="flex items-center gap-2 text-teal-400">
      <MessageSquare className="w-4 h-4 shrink-0" />
      <span className="text-[11px] font-mono tracking-wider font-semibold uppercase">GUIDED PROMPT</span>
    </div>

    <p className="text-xs font-medium text-slate-200 leading-snug">{step.promptQuestion}</p>

    <div className="relative">
      <textarea
        rows={3}
        value={answer}
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder={step.promptPlaceholder || 'Write your thoughts here...'}
        className="w-full p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors resize-none leading-relaxed"
      />

      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
        <span>Optional · For your learning</span>
        {step.suggestedAnswer && (
          <button onClick={onToggleInsight} className="text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors">
            <Sparkles className="w-3 h-3" />
            <span>{showInsight ? 'Hide Insight' : 'Instructor Insight'}</span>
          </button>
        )}
      </div>
    </div>

    {showInsight && step.suggestedAnswer && (
      <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/30 text-xs text-teal-100 leading-relaxed animate-in fade-in duration-200">
        <div className="text-[11px] font-mono font-semibold text-teal-300 mb-0.5">AEROSPACE ENGINEERING CONTEXT:</div>
        {step.suggestedAnswer}
      </div>
    )}
  </div>;
};
