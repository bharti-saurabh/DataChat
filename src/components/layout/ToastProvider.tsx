import { useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { cn } from "@/lib/utils";
import type { ToastVariant } from "@/types";

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-green-500" />,
  error: <XCircle size={16} className="text-red-500" />,
  warning: <AlertTriangle size={16} className="text-yellow-500" />,
  info: <Info size={16} className="text-blue-500" />,
};

const borderColors: Record<ToastVariant, string> = {
  success: "border-green-200 dark:border-green-800",
  error: "border-red-200 dark:border-red-800",
  warning: "border-yellow-200 dark:border-yellow-800",
  info: "border-blue-200 dark:border-blue-800",
};

export function ToastProvider() {
  const { toasts, removeToast } = useDataStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  id,
  variant,
  title,
  message,
  onDismiss,
}: {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto bg-white dark:bg-gray-900 rounded-lg border shadow-lg p-3 flex items-start gap-3 animate-in slide-in-from-right-4",
        borderColors[variant],
      )}
    >
      <div className="mt-0.5 shrink-0">{icons[variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        {message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">{message}</p>}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <X size={14} />
      </button>
    </div>
  );
}
