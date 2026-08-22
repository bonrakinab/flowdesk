"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { CheckCheck, Clock } from "lucide-react";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import {
  expandWeeklySeries,
  type JsWeekday,
  weekdayShortLabels,
} from "@/lib/event-series";
import { EVENT_TYPES, cn } from "@/lib/utils";
import { PriorityPicker } from "@/components/priority/priority-picker";
import { normalizePriority, type Priority } from "@/lib/priority";

export type EditableEvent = {
  id?: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  type: string;
  status?: string | null;
  priority?: string | null;
  externalSource?: string | null;
};

const POSTPONE_OPTIONS: { label: string; minutes: number }[] = [
  { label: "+15m", minutes: 15 },
  { label: "+30m", minutes: 30 },
  { label: "+1h", minutes: 60 },
  { label: "+2h", minutes: 120 },
  { label: "+1 day", minutes: 24 * 60 },
];

const WEEKDAYS: { day: JsWeekday; label: string }[] = [
  { day: 0, label: "Sun" },
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
];

function toLocalInput(iso: string) {
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function weekdayFromLocalInput(value: string): JsWeekday {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().getDay() as JsWeekday;
  return d.getDay() as JsWeekday;
}

function emptyForm(defaults?: Partial<EditableEvent>) {
  const start =
    defaults?.startAt || format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const startLocal =
    defaults?.startAt?.includes("T")
      ? defaults.startAt.length > 16
        ? toLocalInput(defaults.startAt)
        : defaults.startAt
      : start;
  return {
    title: defaults?.title || "",
    description: defaults?.description || "",
    startAt: startLocal,
    endAt: defaults?.endAt
      ? defaults.endAt.length > 16
        ? toLocalInput(defaults.endAt)
        : defaults.endAt
      : startLocal,
    allDay: defaults?.allDay ?? false,
    type: defaults?.type || "meeting",
    priority: normalizePriority(defaults?.priority),
    status: defaults?.status || "scheduled",
    recurrent: false,
    byWeekday: [weekdayFromLocalInput(startLocal)] as JsWeekday[],
    untilDate: format(addMonths(new Date(), 3), "yyyy-MM-dd"),
  };
}

export function EventEditorModal({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event: EditableEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(event?.id);
  const [form, setForm] = useState(() => emptyForm(event || undefined));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyForm(event || undefined));
      setError("");
    }
  }, [open, event]);

  const seriesPreview = useMemo(() => {
    if (editing || !form.recurrent || !form.byWeekday.length || !form.untilDate) {
      return [];
    }
    const start = new Date(form.startAt);
    const end = new Date(form.endAt || form.startAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const durationMinutes = Math.max(
      15,
      Math.round((end.getTime() - start.getTime()) / 60_000) || 60
    );
    return expandWeeklySeries({
      byWeekday: form.byWeekday,
      hour: start.getHours(),
      minute: start.getMinutes(),
      durationMinutes,
      from: start,
      until: new Date(`${form.untilDate}T23:59:59`),
    });
  }, [
    editing,
    form.recurrent,
    form.byWeekday,
    form.untilDate,
    form.startAt,
    form.endAt,
  ]);

  if (!open) return null;

  function toggleWeekday(day: JsWeekday) {
    setForm((prev) => {
      const has = prev.byWeekday.includes(day);
      const next = has
        ? prev.byWeekday.filter((d) => d !== day)
        : [...prev.byWeekday, day].sort((a, b) => a - b);
      return { ...prev, byWeekday: next };
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!editing && form.recurrent) {
      if (!form.byWeekday.length) {
        setSaving(false);
        setError("Pick at least one weekday");
        return;
      }
      if (!seriesPreview.length) {
        setSaving(false);
        setError("No occurrences in that date range — check start and until");
        return;
      }
      const res = await fetch("/api/events/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          type: form.type,
          priority: form.priority,
          instances: seriesPreview,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Series create failed");
        return;
      }
      onSaved();
      onClose();
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt || form.startAt).toISOString(),
      allDay: form.allDay,
      type: form.type,
      priority: form.priority,
      status: form.status || "scheduled",
    };
    const res = await fetch(
      editing ? `/api/events/${event!.id}` : "/api/events",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    onSaved();
    onClose();
  }

  async function runAction(
    action: "finish_early" | "postpone",
    postponeMinutes?: number
  ) {
    if (!event?.id) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(action === "postpone" ? { postponeMinutes } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed");
      return;
    }
    onSaved();
    onClose();
  }

  async function remove() {
    if (!event?.id) return;
    if (!confirm("Delete this event?")) return;
    setSaving(true);
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    onSaved();
    onClose();
  }

  const status = form.status || "scheduled";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">
          {editing ? "Edit event" : "New event"}
        </h2>
        {event?.externalSource === "google" && (
          <p className="mb-3 text-xs text-muted">
            Synced from Google — edits stay in Flowdesk (not pushed back to Google).
          </p>
        )}
        {editing && status !== "scheduled" && (
          <p
            className={cn(
              "mb-3 rounded-xl px-3 py-2 text-xs font-medium",
              status === "done" &&
                "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
              status === "postponed" &&
                "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            )}
          >
            {status === "done"
              ? "Marked finished early"
              : "This event was postponed"}
          </p>
        )}
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) =>
                  setForm({ ...form, startAt: e.target.value })
                }
              />
            </div>
            <div>
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <PriorityPicker
              value={form.priority}
              onChange={(priority: Priority) =>
                setForm({ ...form, priority })
              }
            />
          </div>
          <div>
            <Label>Type</Label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="field-control w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground dark:bg-stone-900"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allDay}
              disabled={!editing && form.recurrent}
              onChange={(e) =>
                setForm({ ...form, allDay: e.target.checked })
              }
            />
            All day
          </label>

          {!editing && (
            <div className="space-y-2 rounded-2xl border border-border/80 bg-background/50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.recurrent}
                  onChange={(e) => {
                    const recurrent = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      recurrent,
                      allDay: recurrent ? false : prev.allDay,
                      byWeekday: prev.byWeekday.length
                        ? prev.byWeekday
                        : [weekdayFromLocalInput(prev.startAt)],
                    }));
                  }}
                />
                Recurrent
              </label>
              {form.recurrent && (
                <>
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Repeat on
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((w) => {
                        const on = form.byWeekday.includes(w.day);
                        return (
                          <button
                            key={w.day}
                            type="button"
                            onClick={() => toggleWeekday(w.day)}
                            className={cn(
                              "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                              on
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-border bg-card text-muted hover:border-accent/40"
                            )}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label>Until</Label>
                    <Input
                      type="date"
                      required={form.recurrent}
                      value={form.untilDate}
                      onChange={(e) =>
                        setForm({ ...form, untilDate: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted">
                    {seriesPreview.length
                      ? `${seriesPreview.length} occurrence${
                          seriesPreview.length === 1 ? "" : "s"
                        } · ${weekdayShortLabels(form.byWeekday)} · from start time`
                      : "Pick weekdays and an until date"}
                  </p>
                </>
              )}
            </div>
          )}

          {editing && (
            <div className="space-y-2 rounded-2xl border border-border/80 bg-background/50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Schedule changes
              </div>
              <Button
                type="button"
                variant="soft"
                className="w-full justify-start"
                disabled={saving || status === "done"}
                onClick={() => void runAction("finish_early")}
              >
                <CheckCheck size={15} />
                Finished early
                <span className="ml-auto text-[11px] font-normal opacity-70">
                  End now
                </span>
              </Button>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <Clock size={12} />
                  Postpone by
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POSTPONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.minutes}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void runAction("postpone", opt.minutes)
                      }
                      className={cn(
                        "rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {editing ? (
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => void remove()}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save"
                    : form.recurrent
                      ? seriesPreview.length
                        ? `Create ${seriesPreview.length}`
                        : "Create series"
                      : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
