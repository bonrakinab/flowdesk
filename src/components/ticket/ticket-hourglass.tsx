"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function formatElapsed(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function useElapsedSeconds(startedAt: string | null | undefined) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

export function TicketHourglass({
  startedAt,
  estimateMin,
  compact = false,
  light = false,
  className,
}: {
  startedAt: string | null | undefined;
  estimateMin?: number | null;
  compact?: boolean;
  light?: boolean;
  className?: string;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  if (!startedAt) return null;

  const estimateSec = estimateMin && estimateMin > 0 ? estimateMin * 60 : null;
  const progress = estimateSec
    ? Math.min(1, elapsed / estimateSec)
    : Math.min(1, (elapsed % 3600) / 3600);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        compact ? "text-xs" : "text-sm",
        light ? "text-white/90" : "text-warm",
        className
      )}
      title="Time on this task"
    >
      <span
        className={cn(
          "hourglass-spin inline-flex shrink-0 select-none",
          compact ? "text-base" : "text-lg"
        )}
        aria-hidden
      >
        ⏳
      </span>
      <div className="min-w-0">
        <div
          className={cn(
            "font-mono font-semibold tabular-nums tracking-tight",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {formatElapsed(elapsed)}
        </div>
        {!compact && estimateSec && (
          <div
            className={cn(
              "mt-1 h-1 w-20 overflow-hidden rounded-full",
              light ? "bg-white/20" : "bg-warm/20"
            )}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-1000",
                light ? "bg-white" : "bg-warm",
                progress >= 1 && "!bg-danger"
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export { formatElapsed };
