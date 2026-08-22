"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  isBefore,
  isToday,
  startOfDay,
  parseISO,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClock,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  NotebookPen,
  Plus,
  Sparkles,
  Star,
  Zap,
  Pill,
  Check,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { WeatherWidget } from "@/components/weather/weather-widget";
import { SmartComposer } from "@/components/today/smart-composer";
import { DailyQuote } from "@/components/today/daily-quote";
import {
  EventEditorModal,
  type EditableEvent,
} from "@/components/calendar/event-editor";
import { TicketHourglass } from "@/components/ticket/ticket-hourglass";
import { cn } from "@/lib/utils";
import { playTaskCompleteTone } from "@/lib/sounds";
import { priorityGlowClass, priorityBadgeClass } from "@/lib/priority";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  estimateMin: number | null;
  isFocus: boolean;
  isInbox?: boolean;
  workStartedAt?: string | null;
  waitingOn: string | null;
  assignee: { id: string; name: string | null; color: string } | null;
  project: { id: string; name: string; color: string } | null;
};

type Reminder = {
  id: string;
  title: string | null;
  remindAt: string;
  ticket: { id: string; title: string } | null;
};

type Event = {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  type?: string;
  status?: string | null;
  priority?: string | null;
  externalSource?: string | null;
};

type Note = {
  id: string;
  title: string;
  pinned: boolean;
  mood: string | null;
};

type MedDose = {
  medicationId: string;
  name: string;
  dosage: string | null;
  color: string;
  scheduledFor: string;
  time: string;
  takenAt: string | null;
  skipped: boolean;
};

type SectionKey =
  | "overdue"
  | "dueToday"
  | "waiting"
  | "quickWins"
  | "focus"
  | "events"
  | "reminders"
  | "meds"
  | "notes";

const SECTION_META: Record<
  SectionKey,
  {
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tone: "danger" | "warm" | "accent" | "neutral";
  }
> = {
  overdue: { title: "Overdue", icon: AlarmClock, tone: "danger" },
  dueToday: { title: "Due today", icon: Calendar, tone: "warm" },
  waiting: { title: "Waiting on", icon: Clock, tone: "warm" },
  quickWins: { title: "Quick wins", icon: Zap, tone: "accent" },
  focus: { title: "Focus", icon: Star, tone: "accent" },
  events: { title: "Next events", icon: Calendar, tone: "neutral" },
  reminders: { title: "Reminders", icon: AlarmClock, tone: "warm" },
  meds: { title: "Meds due", icon: Pill, tone: "accent" },
  notes: { title: "Pinned notes", icon: NotebookPen, tone: "neutral" },
};

function TicketRow({
  ticket,
  onToggleFocus,
  onFinish,
  featured,
}: {
  ticket: Ticket;
  onToggleFocus: (id: string, v: boolean) => void;
  onFinish: (id: string) => void;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition",
        featured
          ? "border-white/15 bg-white/10"
          : "border-border/70 bg-white/60 hover:border-accent/30 dark:bg-white/5",
        priorityGlowClass(ticket.priority, {
          done: ticket.status === "Done",
        })
      )}
    >
      <button
        type="button"
        onClick={() => onToggleFocus(ticket.id, !ticket.isFocus)}
        className={cn(
          "mt-0.5 shrink-0 rounded-lg p-1.5 transition",
          ticket.isFocus
            ? featured
              ? "text-amber-200"
              : "text-accent"
            : featured
              ? "text-white/50 hover:text-white"
              : "text-muted hover:text-accent"
        )}
        aria-label={ticket.isFocus ? "Remove focus" : "Add to focus"}
      >
        <Star size={15} fill={ticket.isFocus ? "currentColor" : "none"} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Link
            href={`/tickets/${ticket.id}`}
            className={cn(
              "block min-w-0 flex-1 truncate text-sm font-semibold hover:underline",
              featured
                ? "text-white"
                : "text-foreground hover:text-accent"
            )}
          >
            {ticket.title}
          </Link>
          {ticket.workStartedAt && (
            <TicketHourglass
              startedAt={ticket.workStartedAt}
              estimateMin={ticket.estimateMin}
              compact
              light={featured}
            />
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            tone="neutral"
            className={featured ? "bg-white/15 text-white" : undefined}
          >
            {ticket.status}
          </Badge>
          <Badge
            tone="neutral"
            className={cn(
              featured ? "bg-white/15 text-white" : priorityBadgeClass(ticket.priority)
            )}
          >
            {ticket.priority}
          </Badge>
          {ticket.waitingOn && (
            <span
              className={cn(
                "text-[11px]",
                featured ? "text-white/70" : "text-muted"
              )}
            >
              Waiting: {ticket.waitingOn}
            </span>
          )}
        </div>
      </div>
      {ticket.status !== "Done" && (
        <button
          type="button"
          onClick={() => onFinish(ticket.id)}
          className={cn(
            "mt-0.5 shrink-0 rounded-lg p-1.5 transition",
            featured
              ? "text-emerald-200 hover:bg-white/10"
              : "text-accent hover:bg-accent-soft"
          )}
          title="Finish task"
          aria-label="Finish task"
        >
          <CheckCircle2 size={16} />
        </button>
      )}
    </div>
  );
}

export default function TodayPage() {
  const { data: session } = useSession();
  const [mine, setMine] = useState(true);
  const [highlightOnly, setHighlightOnly] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [medDoses, setMedDoses] = useState<MedDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState<"ticket" | "event" | null>("ticket");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EditableEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const ticketUrl = mine ? "/api/tickets?mine=1" : "/api/tickets";
    const today = new Date();
    const from = startOfDay(today).toISOString();
    const to = new Date(today.getTime() + 86400000 * 2).toISOString();
    const [tRes, rRes, eRes, nRes, mRes] = await Promise.all([
      fetch(ticketUrl),
      fetch("/api/reminders"),
      fetch(`/api/events?from=${from}&to=${to}`),
      fetch("/api/notes"),
      fetch(`/api/meds?tzOffset=${new Date().getTimezoneOffset()}`),
    ]);
    if (tRes.ok) setTickets(await tRes.json());
    if (rRes.ok) setReminders(await rRes.json());
    if (eRes.ok) setEvents(await eRes.json());
    if (nRes.ok) {
      const data = await nRes.json();
      setNotes(data.notes || []);
    }
    if (mRes.ok) {
      const data = await mRes.json();
      setMedDoses(data.todayDoses || []);
    }
    setLoading(false);
  }, [mine]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFocus = async (id: string, isFocus: boolean) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isFocus } : t))
    );
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFocus }),
    });
  };

  const finishTicket = async (id: string) => {
    playTaskCompleteTone();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "Done", isFocus: false, workStartedAt: null }
          : t
      )
    );
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish" }),
    });
    load();
  };

  const openTickets = useMemo(
    () => tickets.filter((t) => t.status !== "Done" && !t.isInbox),
    [tickets]
  );

  const todayStart = startOfDay(new Date());

  const buckets = useMemo(() => {
    const overdue = openTickets.filter(
      (t) => t.dueAt && isBefore(parseISO(t.dueAt), todayStart)
    );
    const dueToday = openTickets.filter(
      (t) => t.dueAt && isToday(parseISO(t.dueAt))
    );
    const waiting = openTickets.filter((t) => t.status === "Waiting");
    const quickWins = openTickets.filter(
      (t) => t.estimateMin != null && t.estimateMin <= 15
    );
    const focus = openTickets.filter((t) => t.isFocus);
    const nextEvents = events
      .filter((e) => parseISO(e.endAt) >= new Date())
      .sort(
        (a, b) =>
          parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime()
      )
      .slice(0, 5);
    const todayReminders = reminders.filter((r) =>
      isToday(parseISO(r.remindAt))
    );
    const pinnedNotes = notes.filter((n) => n.pinned).slice(0, 4);
    const pendingMeds = medDoses.filter((d) => !d.takenAt && !d.skipped);

    return {
      overdue,
      dueToday,
      waiting,
      quickWins,
      focus,
      events: nextEvents,
      reminders: todayReminders,
      meds: pendingMeds,
      notes: pinnedNotes,
    };
  }, [openTickets, events, reminders, notes, medDoses, todayStart]);

  const activeSections = (
    [
      "overdue",
      "dueToday",
      "meds",
      "waiting",
      "focus",
      "quickWins",
      "events",
      "reminders",
      "notes",
    ] as SectionKey[]
  ).filter((key) => {
    const data = buckets[key];
    return Array.isArray(data) && data.length > 0;
  });

  const highlightKey = activeSections[0] || null;
  const restKeys = highlightOnly
    ? activeSections.slice(1)
    : activeSections.filter((k) => k !== highlightKey);

  function renderTicketList(list: Ticket[], featured?: boolean) {
    return (
      <div className="space-y-2">
        {list.map((t) => (
          <TicketRow
            key={t.id}
            ticket={t}
            onToggleFocus={toggleFocus}
            onFinish={finishTicket}
            featured={featured}
          />
        ))}
      </div>
    );
  }

  function renderSectionBody(key: SectionKey, featured?: boolean) {
    if (key === "events") {
      return (
        <div className="space-y-2">
          {buckets.events.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setEditing({
                  id: e.id,
                  title: e.title,
                  description: e.description || "",
                  startAt: e.startAt,
                  endAt: e.endAt,
                  allDay: e.allDay,
                  type: e.type || "meeting",
                  status: e.status || "scheduled",
                  priority: e.priority || "P2",
                  externalSource: e.externalSource,
                });
                setEditorOpen(true);
              }}
              className={cn(
                "block w-full rounded-2xl border px-3.5 py-3 text-left transition",
                featured
                  ? "border-white/15 bg-white/10 text-white"
                  : "border-border/70 bg-white/60 hover:border-accent/30 dark:bg-white/5",
                priorityGlowClass(e.priority, {
                  done: e.status === "done",
                })
              )}
            >
              <div className="text-sm font-semibold">{e.title}</div>
              <div
                className={cn(
                  "mt-0.5 text-xs",
                  featured ? "text-white/70" : "text-muted"
                )}
              >
                {e.allDay
                  ? "All day"
                  : format(parseISO(e.startAt), "EEE · h:mm a")}
                <span className="opacity-70"> · Edit</span>
              </div>
            </button>
          ))}
        </div>
      );
    }
    if (key === "reminders") {
      return (
        <div className="space-y-2">
          {buckets.reminders.map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-2xl border px-3.5 py-3 text-sm",
                featured
                  ? "border-white/15 bg-white/10 text-white"
                  : "border-border/70 bg-white/60 dark:bg-white/5"
              )}
            >
              {r.title || r.ticket?.title || "Reminder"} ·{" "}
              {format(parseISO(r.remindAt), "h:mm a")}
            </div>
          ))}
        </div>
      );
    }
    if (key === "meds") {
      return (
        <div className="space-y-2">
          {buckets.meds.map((d) => (
            <div
              key={`${d.medicationId}-${d.scheduledFor}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3.5 py-3",
                featured
                  ? "border-white/15 bg-white/10 text-white"
                  : "border-border/70 bg-white/60 dark:bg-white/5"
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: featured ? "#fff" : d.color }}
              />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold">
                  {d.name}
                  {d.dosage ? ` · ${d.dosage}` : ""}
                </div>
                <div
                  className={cn(
                    "text-xs",
                    featured ? "text-white/70" : "text-muted"
                  )}
                >
                  {format(parseISO(d.scheduledFor), "h:mm a")}
                </div>
              </div>
              <Button
                size="sm"
                variant={featured ? "secondary" : "soft"}
                onClick={async () => {
                  await fetch("/api/meds/doses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      medicationId: d.medicationId,
                      scheduledFor: d.scheduledFor,
                      action: "taken",
                    }),
                  });
                  load();
                }}
              >
                <Check size={14} /> Take
              </Button>
            </div>
          ))}
          <Link
            href="/meds"
            className={cn(
              "block text-xs underline",
              featured ? "text-white/80" : "text-accent"
            )}
          >
            Manage meds
          </Link>
        </div>
      );
    }
    if (key === "notes") {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {buckets.notes.map((n) => (
            <Link
              key={n.id}
              href={`/notes?id=${n.id}`}
              className={cn(
                "rounded-2xl border px-3.5 py-3 text-sm transition",
                featured
                  ? "border-white/15 bg-white/10 text-white"
                  : "paper-surface border-border/70 hover:border-accent/40"
              )}
            >
              <div className="font-semibold">{n.title}</div>
            </Link>
          ))}
        </div>
      );
    }
    return renderTicketList(buckets[key] as Ticket[], featured);
  }

  return (
    <div className="atmosphere min-h-full p-4 md:p-8">
      <div className="page-canvas mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            Today Radar
          </h1>
          <p className="mt-1 text-sm text-muted">
            {session?.user?.name
              ? `Hello, ${session.user.name.split(" ")[0]}`
              : "Due and starred work"}
          </p>
        </motion.div>

        <div className="mb-5">
          <WeatherWidget />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border/80 bg-card/90 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMine(true)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                mine ? "bg-accent text-white" : "text-muted hover:text-foreground"
              )}
            >
              Mine
            </button>
            <button
              type="button"
              onClick={() => setMine(false)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                !mine
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              )}
            >
              Family
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHighlightOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition",
              highlightOnly
                ? "border-accent/30 bg-accent-soft text-accent"
                : "border-border bg-card text-muted hover:text-foreground"
            )}
          >
            <Sparkles size={13} />
            {highlightOnly ? "Highlight on" : "Highlight off"}
          </button>

          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant={composer === "ticket" ? "primary" : "secondary"}
              onClick={() => setComposer("ticket")}
            >
              <Plus size={14} />
              Ticket
            </Button>
            <Button
              size="sm"
              variant={composer === "event" ? "primary" : "secondary"}
              onClick={() => setComposer("event")}
            >
              <CalendarPlus size={14} />
              Event
            </Button>
            <Link href="/notes">
              <Button size="sm" variant="ghost">
                <NotebookPen size={14} />
                Note
              </Button>
            </Link>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {composer && (
            <motion.div
              key={composer}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-6"
            >
              <SmartComposer kind={composer} onCreated={load} />
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-3">
            <div className="h-40 animate-pulse rounded-3xl bg-stone-200/50" />
            <div className="h-24 animate-pulse rounded-3xl bg-stone-200/40" />
          </div>
        ) : activeSections.length === 0 ? (
          <Panel className="text-center py-14">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              All clear
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Nothing overdue, due, or starred.
            </p>
          </Panel>
        ) : (
          <div className="space-y-5">
            {highlightKey && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className={cn(
                    "overflow-hidden rounded-3xl border shadow-[0_20px_50px_rgba(28,25,23,0.12)]",
                    SECTION_META[highlightKey].tone === "danger" &&
                      "border-rose-400/30 bg-gradient-to-br from-stone-900 via-[#3f1d2a] to-[#9f1239]",
                    SECTION_META[highlightKey].tone === "warm" &&
                      "border-orange-300/30 bg-gradient-to-br from-stone-900 via-[#3b2414] to-[#c2410c]",
                    SECTION_META[highlightKey].tone === "accent" &&
                      "border-teal-300/30 bg-gradient-to-br from-stone-900 via-[#134e4a] to-[#0d9488]",
                    SECTION_META[highlightKey].tone === "neutral" &&
                      "border-stone-500/30 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-700"
                  )}
                >
                  <div className="px-5 py-5 md:px-6 md:py-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-white">
                        {(() => {
                          const Icon = SECTION_META[highlightKey].icon;
                          return <Icon size={18} className="text-white/80" />;
                        })()}
                        <h2 className="font-[family-name:var(--font-display)] text-xl">
                          {SECTION_META[highlightKey].title}
                        </h2>
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {(buckets[highlightKey] as unknown[]).length}
                        </span>
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                        Highlight
                      </span>
                    </div>
                    {renderSectionBody(highlightKey, true)}
                  </div>
                </div>
              </motion.div>
            )}

            {restKeys.length > 0 && (
              <div className="space-y-4">
                {!highlightOnly && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Also active
                  </p>
                )}
                {highlightOnly && restKeys.length > 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Also active
                  </p>
                )}
                <div className="space-y-3">
                  {restKeys.map((key) => {
                    const Icon = SECTION_META[key].icon;
                    const count = (buckets[key] as unknown[]).length;
                    return (
                      <Panel key={key} className="!p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Icon size={15} className="text-accent" />
                          <h3 className="text-sm font-semibold">
                            {SECTION_META[key].title}
                          </h3>
                          <Badge tone="accent">{count}</Badge>
                        </div>
                        {renderSectionBody(key)}
                      </Panel>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DailyQuote />
      </div>
      <EventEditorModal
        open={editorOpen}
        event={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
}
