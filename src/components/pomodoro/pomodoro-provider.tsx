"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Phase = "work" | "break";

type PomodoroState = {
  running: boolean;
  phase: Phase;
  secondsLeft: number;
  workMinutes: number;
  breakMinutes: number;
  ticketId: string | null;
  ticketTitle: string | null;
  sessionId: string | null;
  muted: boolean;
  start: (opts?: {
    workMinutes?: number;
    breakMinutes?: number;
    ticketId?: string | null;
    ticketTitle?: string | null;
  }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setMuted: (v: boolean) => void;
};

import { playPhaseChime } from "@/lib/sounds";

const Ctx = createContext<PomodoroState | null>(null);

function chime(muted: boolean) {
  playPhaseChime(muted);
  if (muted || typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Flowdesk Focus", {
      body: "Timer phase complete",
      icon: "/icons/icon-192.png",
    });
  }
}

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("work");
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketTitle, setTicketTitle] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        chime(muted);
        if (phase === "work") {
          setPhase("break");
          return breakMinutes * 60;
        }
        setPhase("work");
        setRunning(false);
        if (sessionId) {
          fetch("/api/pomodoro", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: sessionId,
              status: "done",
              completed: true,
              phase: "work",
            }),
          }).catch(() => null);
        }
        return workMinutes * 60;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, phase, breakMinutes, workMinutes, muted, sessionId]);

  const start = useCallback(
    async (opts?: {
      workMinutes?: number;
      breakMinutes?: number;
      ticketId?: string | null;
      ticketTitle?: string | null;
    }) => {
      const w = opts?.workMinutes ?? 25;
      const b = opts?.breakMinutes ?? 5;
      setWorkMinutes(w);
      setBreakMinutes(b);
      setSecondsLeft(w * 60);
      setPhase("work");
      setTicketId(opts?.ticketId ?? null);
      setTicketTitle(opts?.ticketTitle ?? null);
      setRunning(true);
      const res = await fetch("/api/pomodoro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workMinutes: w,
          breakMinutes: b,
          ticketId: opts?.ticketId ?? null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.id);
        if (data.ticket?.title) setTicketTitle(data.ticket.title);
      }
    },
    []
  );

  const pause = useCallback(() => setRunning(false), []);
  const resume = useCallback(() => setRunning(true), []);
  const reset = useCallback(() => {
    setRunning(false);
    setPhase("work");
    setSecondsLeft(workMinutes * 60);
  }, [workMinutes]);

  const value = useMemo(
    () => ({
      running,
      phase,
      secondsLeft,
      workMinutes,
      breakMinutes,
      ticketId,
      ticketTitle,
      sessionId,
      muted,
      start,
      pause,
      resume,
      reset,
      setMuted,
    }),
    [
      running,
      phase,
      secondsLeft,
      workMinutes,
      breakMinutes,
      ticketId,
      ticketTitle,
      sessionId,
      muted,
      start,
      pause,
      resume,
      reset,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePomodoro() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePomodoro outside provider");
  return ctx;
}
