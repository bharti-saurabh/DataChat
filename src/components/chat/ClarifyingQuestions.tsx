import { useState } from "react";
import { HelpCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClarificationQuestion } from "@/types";

interface ClarifyingQuestionsProps {
  questions: ClarificationQuestion[];
  originalQuestion: string;
  onSubmit: (enrichedQuestion: string) => void;
  onSkip: () => void;
}

interface AnswerState {
  selected: string | null; // the chosen option label, or "Other"
  freeText: string;        // only used when selected === "Other"
}

export function ClarifyingQuestions({ questions, originalQuestion, onSubmit, onSkip }: ClarifyingQuestionsProps) {
  const [answers, setAnswers] = useState<AnswerState[]>(
    questions.map(() => ({ selected: null, freeText: "" })),
  );

  function setAnswer(i: number, patch: Partial<AnswerState>) {
    setAnswers((prev) => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }

  function handleSubmit() {
    const parts = [originalQuestion];
    questions.forEach(({ question }, i) => {
      const a = answers[i];
      const value = a.selected === "Other" ? a.freeText.trim() : a.selected ?? "";
      if (value) parts.push(`${question} → ${value}`);
    });
    onSubmit(parts.join("\n"));
  }

  const hasAnyAnswer = answers.some((a) => {
    if (!a.selected) return false;
    if (a.selected === "Other") return a.freeText.trim().length > 0;
    return true;
  });

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
        <HelpCircle size={15} />
        A few quick questions to improve your answer:
      </div>

      <div className="space-y-4">
        {questions.map(({ question, options }, i) => {
          const answer = answers[i];
          const allOptions = [...options, "Other"];
          return (
            <div key={i} className="space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{question}</p>
              <div className="flex flex-wrap gap-1.5">
                {allOptions.map((opt) => {
                  const isSelected = answer.selected === opt;
                  const isOther = opt === "Other";
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(i, { selected: isSelected ? null : opt, freeText: "" })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        isSelected
                          ? isOther
                            ? "bg-gray-600 border-gray-600 text-white"
                            : "bg-blue-600 border-blue-600 text-white"
                          : isOther
                          ? "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-900"
                          : "border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 bg-white dark:bg-gray-900",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {answer.selected === "Other" && (
                <input
                  autoFocus
                  type="text"
                  value={answer.freeText}
                  onChange={(e) => setAnswer(i, { freeText: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && hasAnyAnswer && handleSubmit()}
                  placeholder="Type your answer…"
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!hasAnyAnswer}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg font-medium"
        >
          <Send size={13} /> Submit answers
        </button>
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Skip, just ask
        </button>
      </div>
    </div>
  );
}
