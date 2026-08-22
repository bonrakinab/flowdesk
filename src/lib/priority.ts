import { cn, PRIORITIES } from "@/lib/utils";

export { PRIORITIES };
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "Urgent",
  P1: "High",
  P2: "Normal",
  P3: "Low",
};

export function isPriority(value: string | null | undefined): value is Priority {
  return PRIORITIES.includes((value || "") as Priority);
}

export function normalizePriority(
  value: string | null | undefined,
  fallback: Priority = "P2"
): Priority {
  return isPriority(value) ? value : fallback;
}

export function priorityRank(value: string | null | undefined): number {
  const i = PRIORITIES.indexOf(normalizePriority(value));
  return i === -1 ? 2 : i;
}

/**
 * Visible priority treatment. Uses Tailwind utilities so the effect still
 * shows even if custom CSS animations are blocked/clipped.
 * Skip for done items and Normal (P2).
 */
export function priorityGlowClass(
  value: string | null | undefined,
  opts?: { done?: boolean; compact?: boolean }
) {
  if (opts?.done) return "";
  const p = normalizePriority(value);
  if (p === "P0") {
    return cn(
      "priority-glow-p0 border border-rose-500 bg-rose-100 text-rose-800 shadow-[0_0_18px_rgba(225,29,72,0.65)] ring-2 ring-rose-400/80 animate-pulse dark:bg-rose-950/70 dark:text-rose-100",
      opts?.compact && "cal-priority-chip font-semibold"
    );
  }
  if (p === "P1") {
    return cn(
      "priority-glow-p1 border border-orange-500 bg-orange-100 text-orange-900 shadow-[0_0_18px_rgba(234,88,12,0.6)] ring-2 ring-orange-400/80 animate-pulse dark:bg-orange-950/70 dark:text-orange-100",
      opts?.compact && "cal-priority-chip font-semibold"
    );
  }
  if (p === "P3") return "priority-glow-p3 opacity-70";
  return "";
}

export function priorityBadgeClass(value: string | null | undefined) {
  const p = normalizePriority(value);
  return cn(
    p === "P0" && "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    p === "P1" &&
      "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    p === "P2" && "bg-stone-200/80 text-muted dark:bg-white/10",
    p === "P3" && "bg-stone-100 text-muted/80 dark:bg-white/5"
  );
}

export function priorityOptionLabel(p: Priority) {
  return `${p} · ${PRIORITY_LABELS[p]}`;
}
