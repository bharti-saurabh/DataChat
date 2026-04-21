import { Sparkles } from "lucide-react";

interface FollowUpChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function FollowUpChips({ suggestions, onSelect }: FollowUpChipsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <Sparkles size={12} className="text-gray-400 shrink-0" />
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
