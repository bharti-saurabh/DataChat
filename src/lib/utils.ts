import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { dsvFormat } from "d3-dsv";
import type { QueryRow } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(data: QueryRow[], filename = "datachat.csv") {
  if (data.length === 0) return;
  const csv = dsvFormat(",").format(data);
  downloadFile(csv, filename, "text/csv");
}

export async function exportExcel(data: QueryRow[], filename = "datachat.xlsx") {
  const { utils, writeFile } = await import("xlsx");
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Data");
  writeFile(wb, filename);
}

export function exportJSON(data: QueryRow[], filename = "datachat.json") {
  downloadFile(JSON.stringify(data, null, 2), filename, "application/json");
}

export function extractSQL(text: string): string {
  const match = text.match(/```(?:sql)?\s*\n([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? text.trim();
}

export function extractJSCode(text: string): string | null {
  const match = text.match(/```js\s*\n([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? null;
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
