import { BarChart2, Code2, Check, Sparkles, ArrowRight } from "lucide-react";
import type { AppMode } from "@/types";

const EXPLORER_FEATURES = [
  "AI builds your dashboard automatically from a prompt",
  "KPIs, charts, tables & insights — all in one view",
  "AI commentary per widget with conversational refinement",
  "Connect files, databases, and cloud sources in one place",
];

const ANALYST_FEATURES = [
  "Natural-language to SQL with full query editor",
  "Conversational chart editing — filter, sort, limit by chat",
  "Document & presentation dashboards with PDF export",
  "Python / pandas code generation from SQL results",
];

interface RoleCardProps {
  role: "BUSINESS USER" | "TECHNICAL USER";
  title: "Explorer" | "Analyst";
  description: string;
  features: string[];
  icon: React.ReactNode;
  buttonLabel: string;
  buttonClass: string;
  iconBg: string;
  badgeClass: string;
  onSelect: () => void;
}

function RoleCard({
  role, title, description, features, icon,
  buttonLabel, buttonClass, iconBg, badgeClass, onSelect,
}: RoleCardProps) {
  return (
    <div
      className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-8 cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className={`text-[10px] font-bold tracking-widest uppercase mb-0.5 ${badgeClass}`}>{role}</p>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>
      </div>

      <p className="text-gray-500 text-sm leading-relaxed mb-6">{description}</p>

      <ul className="space-y-2.5 mb-8 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
            <Check size={14} className="shrink-0 mt-0.5 text-indigo-500" />
            {f}
          </li>
        ))}
      </ul>

      <button
        className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold text-white transition-opacity group-hover:opacity-90 ${buttonClass}`}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {buttonLabel}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

interface RoleSelectionProps {
  onSelect: (mode: AppMode) => void;
}

export function RoleSelection({ onSelect }: RoleSelectionProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-indigo-50 via-purple-50/60 to-blue-50">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
        {/* Logo + badge */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">DataChat</span>
          <span className="text-[10px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm">
            AI-Powered Data Intelligence
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-2xl mb-4">
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-3">
            Turn data into{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">
              decisions, instantly.
            </span>
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">
            Chat with your data, build dashboards, and uncover insights
            <br />— powered by AI. Choose the experience built for you.
          </p>
        </div>

        <p className="text-sm text-gray-400 mb-10">Select your role to get started ↓</p>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <RoleCard
            role="BUSINESS USER"
            title="Explorer"
            description="Upload your data and instantly get an AI-generated dashboard with charts, KPIs, and plain-English insights. No SQL, no setup — just answers."
            features={EXPLORER_FEATURES}
            icon={<BarChart2 size={22} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
            badgeClass="text-indigo-500"
            buttonLabel="Launch Explorer"
            buttonClass="bg-gradient-to-r from-indigo-500 to-violet-600"
            onSelect={() => onSelect("explorer")}
          />
          <RoleCard
            role="TECHNICAL USER"
            title="Analyst"
            description="Ask questions in plain English, get AI-generated SQL, explore results with charts and tables, and build polished dashboards with PDF export."
            features={ANALYST_FEATURES}
            icon={<Code2 size={22} className="text-teal-600" />}
            iconBg="bg-teal-50"
            badgeClass="text-teal-500"
            buttonLabel="Launch Analyst"
            buttonClass="bg-gradient-to-r from-teal-600 to-cyan-700"
            onSelect={() => onSelect("analyst")}
          />
        </div>
      </div>
    </div>
  );
}
