"use client";

import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  normalizePriority,
  priorityGlowClass,
  type Priority,
} from "@/lib/priority";

export function PriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: Priority) => void;
  disabled?: boolean;
}) {
  const current = normalizePriority(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p)}
          className={cn(
            "rounded-xl border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
            current === p
              ? p === "P0"
                ? "border-danger/50 bg-danger/15 text-danger"
                : p === "P1"
                  ? "border-warm/50 bg-warm-soft text-warm"
                  : "border-accent/40 bg-accent-soft text-accent"
              : "border-border bg-card text-muted hover:border-accent/30",
            current === p && priorityGlowClass(p)
          )}
        >
          {p}
          <span className="ml-1 font-medium normal-case tracking-normal opacity-80">
            {PRIORITY_LABELS[p]}
          </span>
        </button>
      ))}
    </div>
  );
}
