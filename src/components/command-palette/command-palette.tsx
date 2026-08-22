"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePomodoro } from "@/components/pomodoro/pomodoro-provider";

type SearchResult = {
  tickets: { id: string; title: string }[];
  notes: { id: string; title: string }[];
  contacts: { id: string; name: string }[];
  events: { id: string; title: string }[];
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const router = useRouter();
  const pomo = usePomodoro();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  const actions = useMemo(
    () => [
      {
        label: "Go to Today",
        run: () => router.push("/today"),
      },
      {
        label: "Go to Board",
        run: () => router.push("/board"),
      },
      {
        label: "Go to Calendar",
        run: () => router.push("/calendar"),
      },
      {
        label: "Go to Notes",
        run: () => router.push("/notes"),
      },
      {
        label: "Go to Poems",
        run: () => router.push("/poems"),
      },
      {
        label: "Go to Finance",
        run: () => router.push("/finance"),
      },
      {
        label: "Go to Meds",
        run: () => router.push("/meds"),
      },
      {
        label: "Go to Agent",
        run: () => router.push("/agent"),
      },
      {
        label: "Go to Templates",
        run: () => router.push("/templates"),
      },
      {
        label: "Capture to Inbox",
        run: async () => {
          const title = q.trim() || prompt("Quick capture");
          if (!title) return;
          await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, isInbox: true }),
          });
          router.push("/inbox");
        },
      },
      {
        label: "New ticket",
        run: async () => {
          const title = q.trim() || prompt("Ticket title");
          if (!title) return;
          const res = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, status: "Ready" }),
          });
          const ticket = await res.json();
          router.push(`/tickets/${ticket.id}`);
        },
      },
      {
        label: "New event",
        run: async () => {
          const title = q.trim() || prompt("Event title");
          if (!title) return;
          const start = new Date();
          start.setDate(start.getDate() + 1);
          start.setHours(10, 0, 0, 0);
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              startAt: start.toISOString(),
              endAt: end.toISOString(),
            }),
          });
          router.push("/calendar");
        },
      },
      {
        label: "New note",
        run: async () => {
          const title = q.trim() || prompt("Note title") || "Untitled";
          const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          });
          const note = await res.json();
          router.push(`/notes?id=${note.id}`);
        },
      },
      {
        label: "New reminder (1h)",
        run: async () => {
          const title = q.trim() || prompt("Reminder") || "Reminder";
          const remindAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          await fetch("/api/reminders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, remindAt }),
          });
        },
      },
      {
        label: "New finance expense",
        run: async () => {
          const title = q.trim() || prompt("Expense title");
          if (!title) return;
          const amountRaw = prompt("Amount (BDT)");
          const amount = Number(amountRaw);
          if (!(amount > 0)) return;
          await fetch("/api/finance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "expense",
              title,
              amount,
              category: "other",
              scope: "personal",
            }),
          });
          router.push("/finance");
        },
      },
      {
        label: "Start Pomodoro 25/5",
        run: () => {
          pomo.start({ workMinutes: 25, breakMinutes: 5 });
          router.push("/focus");
        },
      },
    ],
    [q, router, pomo]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-stone-950/40 backdrop-blur-sm p-4 grid place-items-start pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-auto rounded-2xl border border-border bg-card shadow-[var(--shadow)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or run a command…"
          className="w-full px-4 py-4 text-base outline-none border-b border-border bg-transparent"
        />
        <div className="max-h-80 overflow-auto scrollbar-thin p-2">
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted">
            Actions
          </div>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-accent-soft"
              onClick={() => {
                setOpen(false);
                a.run();
              }}
            >
              {a.label}
            </button>
          ))}
          {results && (
            <>
              {results.tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-warm-soft"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/tickets/${t.id}`);
                  }}
                >
                  Ticket · {t.title}
                </button>
              ))}
              {results.notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-warm-soft"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/notes?id=${n.id}`);
                  }}
                >
                  Note · {n.title}
                </button>
              ))}
              {results.contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-warm-soft"
                  onClick={() => {
                    setOpen(false);
                    router.push("/people");
                  }}
                >
                  Person · {c.name}
                </button>
              ))}
              {results.events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-warm-soft"
                  onClick={() => {
                    setOpen(false);
                    router.push("/calendar");
                  }}
                >
                  Event · {e.title}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
