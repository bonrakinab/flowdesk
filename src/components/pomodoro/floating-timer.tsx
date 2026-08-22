"use client";

import Link from "next/link";
import { usePomodoro } from "@/components/pomodoro/pomodoro-provider";
import { Pause, Play } from "lucide-react";
import { usePathname } from "next/navigation";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FloatingTimer() {
  const pomo = usePomodoro();
  const pathname = usePathname();
  if (!pomo.running && pomo.phase === "work" && pomo.secondsLeft === pomo.workMinutes * 60) {
    return null;
  }
  if (pathname.startsWith("/focus")) return null;

  const total =
    (pomo.phase === "work" ? pomo.workMinutes : pomo.breakMinutes) * 60;
  const progress = 1 - pomo.secondsLeft / total;

  return (
    <Link
      href="/focus"
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-3 rounded-full border border-border bg-card pl-2 pr-4 py-2 shadow-[var(--shadow)]"
    >
      <div className="relative h-11 w-11">
        <svg className="h-11 w-11 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeDasharray={`${progress * 94} 94`}
            strokeLinecap="round"
          />
        </svg>
        <button
          type="button"
          className="absolute inset-0 grid place-items-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (pomo.running) pomo.pause();
            else pomo.resume();
          }}
        >
          {pomo.running ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
      <div>
        <div className="text-sm font-semibold tabular-nums">{fmt(pomo.secondsLeft)}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted">
          {pomo.phase}
          {pomo.ticketTitle ? ` · ${pomo.ticketTitle.slice(0, 18)}` : ""}
        </div>
      </div>
    </Link>
  );
}
