"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { usePomodoro } from "@/components/pomodoro/pomodoro-provider";
import { Badge, Button, Input, Label, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Ticket = { id: string; title: string; status: string };

type PomodoroSession = {
  id: string;
  workMinutes: number;
  completed: boolean;
  createdAt: string;
  ticket: { id: string; title: string } | null;
};

type PomodoroData = {
  sessions: PomodoroSession[];
  stats: { sessionsToday: number; focusMinutesWeek: number };
};

const CUSTOM_KEY = "flowdesk-pomodoro-custom";

function clampMinutes(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function TimerRing({
  progress,
  secondsLeft,
  phase,
}: {
  progress: number;
  secondsLeft: number;
  phase: string;
}) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const dash = progress * c;

  return (
    <div className="relative mx-auto h-56 w-56">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
        />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-5xl tabular-nums tracking-tight">
            {fmt(secondsLeft)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-widest text-muted">
            {phase}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FocusPage() {
  const pomo = usePomodoro();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<PomodoroData["stats"] | null>(null);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>("");
  const [customWork, setCustomWork] = useState("25");
  const [customBreak, setCustomBreak] = useState("5");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { work?: number; break?: number };
      if (parsed.work) setCustomWork(String(parsed.work));
      if (parsed.break) setCustomBreak(String(parsed.break));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    const [tRes, pRes] = await Promise.all([
      fetch("/api/tickets?mine=1"),
      fetch("/api/pomodoro"),
    ]);
    if (tRes.ok) {
      const list = await tRes.json();
      setTickets(list.filter((t: Ticket) => t.status !== "Done"));
    }
    if (pRes.ok) {
      const data: PomodoroData = await pRes.json();
      setStats(data.stats);
      setSessions(data.sessions.slice(0, 8));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total =
    (pomo.phase === "work" ? pomo.workMinutes : pomo.breakMinutes) * 60;
  const progress = total > 0 ? 1 - pomo.secondsLeft / total : 0;

  const startPreset = (work: number, brk: number) => {
    const ticket = tickets.find((t) => t.id === selectedTicket);
    pomo.start({
      workMinutes: work,
      breakMinutes: brk,
      ticketId: ticket?.id ?? null,
      ticketTitle: ticket?.title ?? null,
    });
  };

  const startCustom = () => {
    const work = clampMinutes(Number(customWork), 1, 180);
    const brk = clampMinutes(Number(customBreak), 1, 60);
    setCustomWork(String(work));
    setCustomBreak(String(brk));
    try {
      localStorage.setItem(
        CUSTOM_KEY,
        JSON.stringify({ work, break: brk })
      );
    } catch {
      /* ignore */
    }
    startPreset(work, brk);
  };

  const idle =
    !pomo.running &&
    pomo.phase === "work" &&
    pomo.secondsLeft === pomo.workMinutes * 60;

  return (
    <div className="atmosphere min-h-full px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Focus
          </h1>
          <p className="mt-1 text-sm text-muted">Pomodoro timer</p>
        </div>

        <TimerRing
          progress={progress}
          secondsLeft={pomo.secondsLeft}
          phase={pomo.phase}
        />

        {pomo.ticketTitle && (
          <p className="mt-4 text-center text-sm text-muted">
            Working on{" "}
            <Link
              href={`/tickets/${pomo.ticketId}`}
              className="font-medium text-accent"
            >
              {pomo.ticketTitle}
            </Link>
          </p>
        )}

        <div className="mt-6">
          <Select
            value={selectedTicket}
            onChange={(e) => setSelectedTicket(e.target.value)}
          >
            <option value="">No ticket linked</option>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            disabled={pomo.running}
            onClick={() => startPreset(25, 5)}
          >
            25 / 5
          </Button>
          <Button
            variant="secondary"
            disabled={pomo.running}
            onClick={() => startPreset(50, 10)}
          >
            50 / 10
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Custom times
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="focus-work">Focus (min)</Label>
              <Input
                id="focus-work"
                type="number"
                min={1}
                max={180}
                inputMode="numeric"
                value={customWork}
                disabled={pomo.running}
                onChange={(e) => setCustomWork(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="focus-break">Break (min)</Label>
              <Input
                id="focus-break"
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={customBreak}
                disabled={pomo.running}
                onChange={(e) => setCustomBreak(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="mt-3 w-full"
            variant="secondary"
            disabled={pomo.running}
            onClick={startCustom}
          >
            Start {clampMinutes(Number(customWork), 1, 180)} /{" "}
            {clampMinutes(Number(customBreak), 1, 60)}
          </Button>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {!pomo.running ? (
            <Button
              className="gap-2 px-8"
              onClick={() =>
                idle
                  ? startPreset(pomo.workMinutes, pomo.breakMinutes)
                  : pomo.resume()
              }
            >
              <Play size={16} />
              {idle ? "Start" : "Resume"}
            </Button>
          ) : (
            <Button variant="secondary" className="gap-2 px-8" onClick={pomo.pause}>
              <Pause size={16} />
              Pause
            </Button>
          )}
          <Button variant="ghost" onClick={pomo.reset}>
            <RotateCcw size={16} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => pomo.setMuted(!pomo.muted)}
            aria-label={pomo.muted ? "Unmute" : "Mute"}
          >
            {pomo.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Button>
        </div>

        {stats && (
          <div className="mt-10 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl text-accent">
                {stats.sessionsToday}
              </div>
              <div className="text-xs text-muted">Sessions today</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl text-accent">
                {stats.focusMinutesWeek}
              </div>
              <div className="text-xs text-muted">Focus min this week</div>
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Recent sessions</h2>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {s.workMinutes}m
                    {s.ticket && (
                      <span className="text-muted"> · {s.ticket.title}</span>
                    )}
                  </span>
                  <Badge
                    className={cn(
                      s.completed
                        ? "bg-accent/10 text-accent"
                        : "bg-black/5"
                    )}
                  >
                    {s.completed ? "Done" : "—"}
                  </Badge>
                  <span className="text-xs text-muted">
                    {format(parseISO(s.createdAt), "MMM d")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
