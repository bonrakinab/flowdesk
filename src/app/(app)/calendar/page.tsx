"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Plus, Upload } from "lucide-react";
import { createPortal } from "react-dom";
import { Badge, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { holidaysInRange, holidayDateLocal } from "@/lib/bd-holidays";
import { doseAtOnDay } from "@/lib/meds";
import { priorityGlowClass, priorityRank, priorityBadgeClass } from "@/lib/priority";
import {
  EventEditorModal,
  type EditableEvent,
} from "@/components/calendar/event-editor";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  type: string;
  status?: string | null;
  color: string | null;
  organizerName?: string | null;
  createdByName?: string | null;
  externalSource?: string | null;
  priority?: string | null;
};

type Ticket = {
  id: string;
  title: string;
  dueAt: string | null;
  status: string;
  priority?: string | null;
};

type Reminder = {
  id: string;
  title: string | null;
  remindAt: string;
  done: boolean;
  ticket: { id: string; title: string } | null;
};

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  color: string;
  times: string[];
  doseLogs: {
    scheduledFor: string;
    takenAt: string | null;
    skipped: boolean;
  }[];
};

type CalendarItem = {
  id: string;
  entityId: string;
  title: string;
  date: Date;
  kind: "event" | "ticket" | "reminder" | "med" | "holiday";
  color?: string;
  href?: string;
  endAt?: string;
  startAt?: string;
  allDay?: boolean;
  done?: boolean;
  status?: string;
  byline?: string;
  priority?: string | null;
};

type ViewMode = "month" | "week" | "day";

/** Date-only values stored as midnight UTC → local civil calendar date. */
function civilDateFromIso(iso: string): Date {
  const d = parseISO(iso);
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0
  ) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return d;
}

function eventOccursOnDay(item: CalendarItem, day: Date): boolean {
  if (!item.endAt) return isSameDay(item.date, day);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  if (item.allDay) {
    const start = startOfDay(item.date).getTime();
    const endParsed = parseISO(item.endAt);
    const endExclusive = new Date(
      endParsed.getUTCFullYear(),
      endParsed.getUTCMonth(),
      endParsed.getUTCDate()
    ).getTime();
    const d = dayStart.getTime();
    if (endExclusive <= start) return d === start;
    return d >= start && d < endExclusive;
  }

  const start = item.date.getTime();
  const end = parseISO(item.endAt).getTime();
  return start <= dayEnd.getTime() && end > dayStart.getTime();
}

type DayPreview = {
  day: Date;
  items: CalendarItem[];
  top: number;
  left: number;
};

function DayHoverPopup({
  preview,
  onClose,
  onActivate,
  onKeep,
}: {
  preview: DayPreview;
  onClose: () => void;
  onKeep: () => void;
  onActivate: (item: CalendarItem) => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed z-[80] w-[min(20rem,calc(100vw-1.5rem))]"
      style={{ top: preview.top, left: preview.left }}
      onMouseEnter={onKeep}
      onMouseLeave={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
      >
        <div className="border-b border-border/70 bg-background/60 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {format(preview.day, "EEEE")}
          </div>
          <div className="font-[family-name:var(--font-display)] text-lg tracking-tight">
            {format(preview.day, "MMMM d")}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {preview.items.length === 0
              ? "Nothing scheduled"
              : `${preview.items.length} item${preview.items.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="max-h-[min(22rem,50vh)] space-y-1.5 overflow-y-auto p-3">
          {preview.items.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted">
              Empty day — click the date to open day view.
            </p>
          ) : (
            preview.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onActivate(item)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl border border-border/70 px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-accent/5",
                  item.done && "opacity-60",
                  priorityGlowClass(item.priority, {
                    done: item.done,
                    compact: true,
                  })
                )}
              >
                <Badge
                  className={cn(
                    "mt-0.5 shrink-0 capitalize",
                    item.kind === "event" && "bg-accent/10 text-accent",
                    item.kind === "ticket" && "bg-warm-soft text-warm",
                    item.kind === "reminder" && "bg-black/5 dark:bg-white/10",
                    item.kind === "med" &&
                      "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
                    item.kind === "holiday" &&
                      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  )}
                >
                  {item.kind}
                </Badge>
                {item.priority &&
                  item.priority !== "P2" &&
                  !item.done && (
                    <Badge
                      className={cn(
                        "mt-0.5 shrink-0",
                        priorityBadgeClass(item.priority)
                      )}
                    >
                      {item.priority}
                    </Badge>
                  )}
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      item.done && "line-through"
                    )}
                  >
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {item.kind === "holiday"
                      ? "All day · BD public holiday"
                      : format(item.date, "h:mm a")}
                    {item.status && item.status !== "scheduled"
                      ? ` · ${item.status}`
                      : ""}
                    {item.byline ? ` · ${item.byline}` : ""}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EditableEvent | null>(null);
  const [dayPreview, setDayPreview] = useState<DayPreview | null>(null);
  const previewTimer = useRef<number | null>(null);
  const [medDose, setMedDose] = useState<{
    medicationId: string;
    title: string;
    scheduledFor: string;
    done?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (view === "day") {
      const from = startOfDay(cursor);
      return { from, to: endOfDay(cursor) };
    }
    if (view === "week") {
      const from = startOfWeek(cursor, { weekStartsOn: 0 });
      return { from, to: endOfWeek(cursor, { weekStartsOn: 0 }) };
    }
    const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return { from, to };
  }, [view, cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    // Always fetch full civil days so morning items aren't dropped when
    // the cursor still carries a wall-clock time (e.g. Day tab / nav).
    const from = startOfDay(range.from).toISOString();
    const to = endOfDay(range.to).toISOString();
    const [eRes, tRes, rRes, mRes] = await Promise.all([
      fetch(`/api/events?from=${from}&to=${to}`),
      fetch("/api/tickets"),
      fetch("/api/reminders?all=1"),
      fetch(`/api/meds?from=${from}&to=${to}&tzOffset=${new Date().getTimezoneOffset()}`),
    ]);
    if (eRes.ok) setEvents(await eRes.json());
    if (tRes.ok) setTickets(await tRes.json());
    if (rRes.ok) setReminders(await rRes.json());
    if (mRes.ok) {
      const data = await mRes.json();
      setMedications(data.medications || []);
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const items: CalendarItem[] = useMemo(() => {
    const list: CalendarItem[] = [];

    events.forEach((e) => {
      const start = parseISO(e.startAt);
      // All-day events are stored as noon UTC — map to local civil date.
      const date = e.allDay
        ? new Date(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate()
          )
        : start;
      const by =
        e.createdByName && e.organizerName && e.createdByName !== e.organizerName
          ? `${e.createdByName} · ${e.organizerName}`
          : e.createdByName || e.organizerName || undefined;
      list.push({
        id: `e-${e.id}`,
        entityId: e.id,
        title:
          e.status === "done"
            ? `Done · ${e.title}`
            : e.status === "postponed"
              ? `Postponed · ${e.title}`
              : e.title,
        date,
        kind: "event",
        color: e.color || "var(--accent)",
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
        done: e.status === "done",
        status: e.status || "scheduled",
        byline: by ? `by ${by}` : undefined,
        priority: e.priority || "P2",
      });
    });

    tickets.forEach((t) => {
      if (!t.dueAt) return;
      list.push({
        id: `t-${t.id}`,
        entityId: t.id,
        title: t.status === "Done" ? `Done · ${t.title}` : t.title,
        date: civilDateFromIso(t.dueAt),
        kind: "ticket",
        href: `/tickets/${t.id}`,
        done: t.status === "Done",
        status: t.status,
        priority: t.priority || "P2",
      });
    });

    reminders.forEach((r) => {
      list.push({
        id: `r-${r.id}`,
        entityId: r.id,
        title: r.done
          ? `Done · ${r.title || r.ticket?.title || "Reminder"}`
          : r.title || r.ticket?.title || "Reminder",
        date: parseISO(r.remindAt),
        kind: "reminder",
        done: r.done,
      });
    });

    const days = eachDayOfInterval({ start: range.from, end: range.to });
    for (const med of medications) {
      for (const day of days) {
        for (const time of med.times || []) {
          const scheduledFor = doseAtOnDay(day, time);
          const log = med.doseLogs?.find(
            (l) =>
              Math.abs(
                parseISO(l.scheduledFor).getTime() - scheduledFor.getTime()
              ) < 60_000
          );
          const done = Boolean(log?.takenAt || log?.skipped);
          const label = med.dosage ? `${med.name} · ${med.dosage}` : med.name;
          list.push({
            id: `m-${med.id}-${scheduledFor.toISOString()}`,
            entityId: med.id,
            title: log?.skipped
              ? `Skip · ${label}`
              : log?.takenAt
                ? `Taken · ${label}`
                : `Med · ${label}`,
            date: scheduledFor,
            startAt: scheduledFor.toISOString(),
            kind: "med",
            color: med.color,
            href: "/meds",
            done,
          });
        }
      }
    }

    for (const h of holidaysInRange(range.from, range.to)) {
      list.push({
        id: `h-${h.date}`,
        entityId: h.date,
        title: h.name,
        date: holidayDateLocal(h),
        kind: "holiday",
        color: "#b45309",
      });
    }

    return list;
  }, [events, tickets, reminders, medications, range]);

  async function snoozeReminder(id: string, hours: number) {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    const next = new Date(parseISO(r.remindAt).getTime() + hours * 3600_000);
    await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, remindAt: next.toISOString() }),
    });
    await load();
  }

  async function moveItemToDay(item: CalendarItem, day: Date) {
    if (item.kind === "holiday" || item.kind === "med") return;
    if (item.kind === "ticket") {
      const due = new Date(day);
      due.setHours(12, 0, 0, 0);
      await fetch(`/api/tickets/${item.entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: due.toISOString() }),
      });
    } else if (item.kind === "event" && item.startAt && item.endAt) {
      const start = parseISO(item.startAt);
      const end = parseISO(item.endAt);
      const duration = end.getTime() - start.getTime();
      const newStart = new Date(day);
      newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
      const newEnd = new Date(newStart.getTime() + duration);
      await fetch(`/api/events/${item.entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        }),
      });
    } else if (item.kind === "reminder") {
      const at = new Date(day);
      at.setHours(item.date.getHours(), item.date.getMinutes(), 0, 0);
      await fetch("/api/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.entityId, remindAt: at.toISOString() }),
      });
    }
    await load();
  }

  const itemsForDay = (day: Date) =>
    items
      .filter((i) =>
        i.kind === "event" ? eventOccursOnDay(i, day) : isSameDay(i.date, day)
      )
      .sort((a, b) => {
        const order = { holiday: 0, event: 1, ticket: 2, med: 3, reminder: 4 };
        const kindDiff = (order[a.kind] ?? 9) - (order[b.kind] ?? 9);
        if (kindDiff !== 0) return kindDiff;
        const pDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (pDiff !== 0) return pDiff;
        return a.date.getTime() - b.date.getTime();
      });

  function clearPreviewTimer() {
    if (previewTimer.current != null) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
  }

  function openDayPreview(day: Date, el: HTMLElement) {
    clearPreviewTimer();
    const dayItems = itemsForDay(day);
    const rect = el.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const approxHeight = Math.min(360, 88 + Math.max(dayItems.length, 1) * 58);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.bottom + 8;
    if (top + approxHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - approxHeight - 8);
    }
    setDayPreview({ day, items: dayItems, top, left });
  }

  function scheduleClosePreview() {
    clearPreviewTimer();
    previewTimer.current = window.setTimeout(() => {
      setDayPreview(null);
    }, 160);
  }

  function keepPreviewOpen() {
    clearPreviewTimer();
  }

  useEffect(() => {
    return () => clearPreviewTimer();
  }, []);

  useEffect(() => {
    setDayPreview(null);
  }, [view, cursor]);

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 0 }),
    end: endOfWeek(cursor, { weekStartsOn: 0 }),
  });

  async function openNewEvent(day?: Date) {
    const base = day || cursor;
    const start = new Date(base);
    if (!day) start.setMinutes(0, 0, 0);
    else start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setEditing({
      title: "",
      description: "",
      startAt: format(start, "yyyy-MM-dd'T'HH:mm"),
      endAt: format(end, "yyyy-MM-dd'T'HH:mm"),
      allDay: false,
      type: "meeting",
    });
    setEditorOpen(true);
  }

  function openEvent(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
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
  }

  function onItemActivate(item: CalendarItem) {
    if (item.kind === "event") {
      openEvent(item.entityId);
      return;
    }
    if (item.kind === "ticket" && item.href) {
      router.push(item.href);
      return;
    }
    if (item.kind === "med") {
      setMedDose({
        medicationId: item.entityId,
        title: item.title,
        scheduledFor: item.startAt || item.date.toISOString(),
        done: item.done,
      });
    }
  }

  const navLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `Week of ${format(startOfWeek(cursor, { weekStartsOn: 0 }), "MMM d")}`
        : format(cursor, "EEEE, MMM d");

  function itemClass(item: CalendarItem) {
    const glow = priorityGlowClass(item.priority, {
      done: item.done,
      compact: true,
    });
    return cn(
      "relative z-[1] block max-w-full rounded-md px-1.5 py-0.5 text-[10px] leading-snug",
      glow ? "overflow-visible whitespace-normal" : "truncate overflow-hidden",
      (item.kind === "event" || item.kind === "ticket" || item.kind === "med") &&
        "cursor-pointer",
      item.kind !== "holiday" &&
        item.kind !== "event" &&
        item.kind !== "ticket" &&
        "cursor-grab",
      item.done && "opacity-50 line-through",
      item.kind === "event" &&
        item.status === "postponed" &&
        "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      item.kind === "event" &&
        item.status !== "postponed" &&
        !glow &&
        "bg-accent/15 text-accent",
      item.kind === "ticket" && !glow && "bg-warm/15 text-warm",
      item.kind === "reminder" && "bg-stone-200 text-muted dark:bg-white/10",
      item.kind === "med" &&
        "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
      item.kind === "holiday" &&
        "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-medium",
      glow
    );
  }

  return (
    <div className="atmosphere min-h-full px-4 py-8 md:px-8">
      <div className="page-canvas">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
              Calendar
            </h1>
            <p className="mt-1 text-sm text-muted">
              Tickets, events, meds, reminders, BD holidays · multi-calendar sync
              on Account
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-border bg-card p-1">
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "primary" : "ghost"}
                  className="rounded-lg px-3 py-1.5 text-xs capitalize"
                  onClick={() => {
                    if (v === "day") setCursor((c) => startOfDay(c));
                    setView(v);
                  }}
                >
                  {v}
                </Button>
              ))}
            </div>
            <Button
              variant="secondary"
              className="gap-1"
              onClick={() => {
                window.location.href = "/api/calendar/export?format=ics";
              }}
            >
              <Download size={14} />
              Export ICS
            </Button>
            <Button
              variant="secondary"
              className="gap-1"
              onClick={() => {
                window.location.href = "/api/calendar/export?format=json";
              }}
            >
              <Download size={14} />
              Export JSON
            </Button>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".ics,.json,text/calendar,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const res = await fetch("/api/calendar/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                  });
                  const data = await res.json();
                  alert(
                    res.ok
                      ? `Imported ${data.calendarsCreated} calendar(s), ${data.eventsCreated} event(s)`
                      : [data.error, data.hint].filter(Boolean).join("\n") ||
                          "Import failed"
                  );
                  if (res.ok) await load();
                  e.target.value = "";
                }}
              />
              <span className="inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-medium">
                <Upload size={14} />
                Import
              </span>
            </label>
            <Button className="gap-1" onClick={() => void openNewEvent()}>
              <Plus size={14} />
              New event
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() =>
              setCursor((c) =>
                view === "month"
                  ? subMonths(c, 1)
                  : addDays(c, view === "week" ? -7 : -1)
              )
            }
          >
            <ChevronLeft size={18} />
          </Button>
          <motion.h2
            key={navLabel}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-[family-name:var(--font-display)] text-xl"
          >
            {navLabel}
          </motion.h2>
          <Button
            variant="ghost"
            onClick={() =>
              setCursor((c) =>
                view === "month"
                  ? addMonths(c, 1)
                  : addDays(c, view === "week" ? 7 : 1)
              )
            }
          >
            <ChevronRight size={18} />
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading calendar…</p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${format(cursor, "yyyy-MM-dd")}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {view === "month" && (
                <div className="overflow-visible rounded-2xl border border-border bg-card/80 p-4 backdrop-blur">
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <div key={d}>{d}</div>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 overflow-visible">
                    {monthDays.map((day) => {
                      const dayItems = itemsForDay(day);
                      const isHoliday = dayItems.some(
                        (i) => i.kind === "holiday"
                      );
                      const previewOpen =
                        dayPreview != null && isSameDay(dayPreview.day, day);
                      return (
                        <div
                          key={day.toISOString()}
                          onDragOver={(e) => e.preventDefault()}
                          onMouseEnter={(e) =>
                            openDayPreview(day, e.currentTarget)
                          }
                          onMouseLeave={scheduleClosePreview}
                          onFocus={(e) =>
                            openDayPreview(day, e.currentTarget)
                          }
                          onBlur={scheduleClosePreview}
                          onDrop={(e) => {
                            e.preventDefault();
                            try {
                              const raw =
                                e.dataTransfer.getData("application/json");
                              if (!raw) return;
                              const item = JSON.parse(raw) as CalendarItem;
                              item.date = new Date(item.date);
                              void moveItemToDay(item, day);
                            } catch {
                              /* ignore */
                            }
                          }}
                          className={cn(
                            "relative min-h-28 overflow-visible rounded-xl border border-border/60 p-2 text-left transition hover:z-10 hover:border-accent/50 hover:shadow-md",
                            !isSameMonth(day, cursor) && "opacity-40",
                            isToday(day) && "border-accent bg-accent/5",
                            isHoliday && "bg-amber-50/80 dark:bg-amber-950/30",
                            previewOpen && "border-accent/60 shadow-md",
                            dayItems.some(
                              (i) =>
                                !i.done &&
                                (i.priority === "P0" || i.priority === "P1")
                            ) && "z-[1]"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCursor(startOfDay(day));
                              setView("day");
                            }}
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                              isToday(day) && "bg-accent text-white",
                              isHoliday &&
                                !isToday(day) &&
                                "text-amber-800 dark:text-amber-200 font-semibold"
                            )}
                          >
                            {format(day, "d")}
                          </button>
                          <div className="mt-1 space-y-1 overflow-visible">
                            {dayItems.slice(0, 4).map((item) => (
                              <div
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                draggable={
                                  item.kind !== "holiday" &&
                                  item.kind !== "med"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onItemActivate(item);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onItemActivate(item);
                                  }
                                }}
                                onDragStart={(e) => {
                                  if (
                                    item.kind === "holiday" ||
                                    item.kind === "med"
                                  )
                                    return;
                                  e.dataTransfer.setData(
                                    "application/json",
                                    JSON.stringify(item)
                                  );
                                  e.stopPropagation();
                                }}
                                className={itemClass(item)}
                                title={
                                  item.byline
                                    ? `${item.title} (${item.byline})`
                                    : item.title
                                }
                              >
                                {(item.priority === "P0" ||
                                  item.priority === "P1") &&
                                !item.done ? (
                                  <span className="mr-0.5 font-bold">
                                    {item.priority}
                                  </span>
                                ) : null}
                                {item.title}
                                {item.byline ? (
                                  <span className="block truncate opacity-70">
                                    {item.byline}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                            {dayItems.length > 4 && (
                              <div className="text-[10px] text-muted">
                                +{dayItems.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {view === "week" && (
                <div className="grid gap-2 md:grid-cols-7">
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "rounded-2xl border border-border bg-card/80 p-3",
                        isToday(day) && "border-accent",
                        itemsForDay(day).some((i) => i.kind === "holiday") &&
                          "bg-amber-50/50 dark:bg-amber-950/20"
                      )}
                    >
                      <button
                        type="button"
                        className="mb-2 text-sm font-medium hover:text-accent"
                        onClick={() => {
                          setCursor(startOfDay(day));
                          setView("day");
                        }}
                      >
                        {format(day, "EEE d")}
                      </button>
                      <div className="space-y-1">
                        {itemsForDay(day).map((item) => (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onItemActivate(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onItemActivate(item);
                              }
                            }}
                            className={cn(
                              "rounded-lg border border-transparent px-2 py-1 text-xs",
                              (item.kind === "event" ||
                                item.kind === "ticket" ||
                                item.kind === "med") &&
                                "cursor-pointer hover:bg-black/10 dark:hover:bg-white/10",
                              item.done && "opacity-50 line-through",
                              item.kind === "holiday"
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-950"
                                : "bg-black/5 dark:bg-white/5",
                              priorityGlowClass(item.priority, {
                                done: item.done,
                                compact: true,
                              })
                            )}
                          >
                            <Badge className="mr-1 text-[9px]">
                              {item.kind}
                            </Badge>
                            {item.priority &&
                              item.priority !== "P2" &&
                              !item.done && (
                                <Badge
                                  className={cn(
                                    "mr-1 text-[9px]",
                                    priorityBadgeClass(item.priority)
                                  )}
                                >
                                  {item.priority}
                                </Badge>
                              )}
                            <span>
                              {item.title}
                              {item.byline ? (
                                <span className="block text-[10px] text-muted">
                                  {item.byline}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === "day" && (
                <div className="rounded-2xl border border-border bg-card/80 p-5">
                  <h3 className="mb-4 font-semibold">
                    {format(cursor, "EEEE, MMMM d")}
                  </h3>
                  {itemsForDay(cursor).length === 0 ? (
                    <p className="text-sm text-muted">Nothing scheduled</p>
                  ) : (
                    <ul className="space-y-2">
                      {itemsForDay(cursor).map((item) => (
                        <li
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onItemActivate(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onItemActivate(item);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border border-border px-4 py-3",
                            (item.kind === "event" ||
                              item.kind === "ticket" ||
                              item.kind === "med") &&
                              "cursor-pointer hover:border-accent/40",
                            item.done && "opacity-60",
                            item.kind === "holiday" &&
                              "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
                            priorityGlowClass(item.priority, {
                              done: item.done,
                              compact: true,
                            })
                          )}
                        >
                          <Badge
                            className={cn(
                              item.kind === "event" &&
                                "bg-accent/10 text-accent",
                              item.kind === "ticket" &&
                                "bg-warm-soft text-warm",
                              item.kind === "reminder" && "bg-black/5",
                              item.kind === "med" &&
                                "bg-teal-50 text-teal-800",
                              item.kind === "holiday" &&
                                "bg-amber-100 text-amber-900"
                            )}
                          >
                            {item.kind}
                          </Badge>
                          {item.priority &&
                            item.priority !== "P2" &&
                            !item.done && (
                              <Badge
                                className={priorityBadgeClass(item.priority)}
                              >
                                {item.priority}
                              </Badge>
                            )}
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "font-medium",
                                item.done && "line-through"
                              )}
                            >
                              {item.title}
                            </div>
                            <div className="text-xs text-muted">
                              {item.kind === "holiday"
                                ? "All day · BD public holiday"
                                : item.allDay
                                  ? "All day"
                                  : format(item.date, "h:mm a")}
                              {item.status ? ` · ${item.status}` : ""}
                              {item.byline ? ` · ${item.byline}` : ""}
                            </div>
                          </div>
                          {item.kind === "reminder" && !item.done && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  void snoozeReminder(item.entityId, 1)
                                }
                              >
                                +1h
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  void snoozeReminder(item.entityId, 24)
                                }
                              >
                                +1d
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {dayPreview && (
        <DayHoverPopup
          preview={dayPreview}
          onKeep={keepPreviewOpen}
          onClose={scheduleClosePreview}
          onActivate={(item) => {
            setDayPreview(null);
            onItemActivate(item);
          }}
        />
      )}

      <EventEditorModal
        open={editorOpen}
        event={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={() => void load()}
      />

      {medDose && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow)]">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
              Medication
            </h2>
            <p className="mt-1 text-sm font-medium">{medDose.title}</p>
            <p className="mt-1 text-xs text-muted">
              {format(parseISO(medDose.scheduledFor), "EEE MMM d · h:mm a")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!medDose.done ? (
                <>
                  <Button
                    onClick={async () => {
                      await fetch("/api/meds/doses", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          medicationId: medDose.medicationId,
                          scheduledFor: medDose.scheduledFor,
                          action: "taken",
                        }),
                      });
                      setMedDose(null);
                      void load();
                    }}
                  >
                    Take
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await fetch("/api/meds/doses", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          medicationId: medDose.medicationId,
                          scheduledFor: medDose.scheduledFor,
                          action: "skipped",
                        }),
                      });
                      setMedDose(null);
                      void load();
                    }}
                  >
                    Skip
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await fetch("/api/meds/doses", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        medicationId: medDose.medicationId,
                        scheduledFor: medDose.scheduledFor,
                        action: "clear",
                      }),
                    });
                    setMedDose(null);
                    void load();
                  }}
                >
                  Undo
                </Button>
              )}
              <Button variant="ghost" onClick={() => setMedDose(null)}>
                Close
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMedDose(null);
                  router.push("/meds");
                }}
              >
                Open Meds
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
