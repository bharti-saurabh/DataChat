import { useState } from "react";
import { HelpCircle, Send } from "lucide-react";

interface ClarifyingQuestionsProps {
  questions: string[];
  originalQuestion: string;
  onSubmit: (enrichedQuestion: string) => void;
  onSkip: () => void;
}

export function ClarifyingQuestions({ questions, originalQuestion, onSubmit, onSkip }: ClarifyingQuestionsProps) {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ""));

  function handleSubmit() {
    const parts = [originalQuestion];
    questions.forEach((q, i) => {
      if (answers[i].trim()) parts.push(`${q} → ${answers[i].trim()}`);
    });
    onSubmit(parts.join("\n"));
  }

  const hasAnyAnswer = answers.some((a) => a.trim());

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
        <HelpCircle size={15} />
        A few quick questions to improve your answer:
      </div>

      <div className="space-y-2.5">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{q}</label>
            <input
              type="text"
              value={answers[i]}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Your answer (optional)…"
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
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
