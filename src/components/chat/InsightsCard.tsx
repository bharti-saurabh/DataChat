import { Lightbulb } from "lucide-react";

interface InsightsCardProps {
  insights?: string;
  loading?: boolean;
}

export function InsightsCard({ insights, loading }: InsightsCardProps) {
  if (!loading && !insights) return null;

  return (
    <div className="flex gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-3">
      <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" />
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="h-2.5 bg-amber-200 dark:bg-amber-800 rounded w-full" />
            <div className="h-2.5 bg-amber-200 dark:bg-amber-800 rounded w-4/5" />
            <div className="h-2.5 bg-amber-200 dark:bg-amber-800 rounded w-3/5" />
          </div>
        ) : (
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{insights}</p>
        )}
      </div>
    </div>
  );
}
