"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Sparkles } from "lucide-react";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { smartParse, type SmartParseResult } from "@/lib/smart-parse";
import {
  expandWeeklySeries,
  weekdayShortLabels,
} from "@/lib/event-series";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; color?: string };
type Member = { id: string; name: string | null; email: string; color?: string };
type Contact = { id: string; name: string };
type Medication = {
  id: string;
  name: string;
  dosage?: string | null;
  times?: string[];
  remindMinutesBefore?: number;
};

function formatMedTime(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":").map((x) => Number(x));
  const d = new Date(2000, 0, 1, hRaw || 0, mRaw || 0);
  return format(d, "h:mm a");
}

export function SmartComposer({
  kind,
  onCreated,
}: {
  kind: "ticket" | "event";
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/household").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/meds?tzOffset=${new Date().getTimezoneOffset()}`).then((r) =>
        r.ok ? r.json() : null
      ),
    ]).then(([p, h, c, meds]) => {
      setProjects(p || []);
      setMembers(h?.users || []);
      setContacts(c || []);
      setMedications(meds?.medications || []);
    });
  }, []);

  const parsed: SmartParseResult = useMemo(
    () =>
      smartParse(
        draft,
        { projects, members, contacts, medications },
        kind
      ),
    [draft, projects, members, contacts, medications, kind]
  );

  const seriesInstances = useMemo(() => {
    if (parsed.intent !== "event_series" || !parsed.recurrence || !parsed.untilAt) {
      return [];
    }
    return expandWeeklySeries({
      byWeekday: parsed.recurrence.byWeekday,
      hour: parsed.recurrence.timeHour,
      minute: parsed.recurrence.timeMinute,
      durationMinutes: parsed.durationMinutes,
      until: new Date(parsed.untilAt),
    });
  }, [parsed]);

  const mode =
    parsed.intent === "medication"
      ? "medication"
      : parsed.intent === "event_series"
        ? "series"
        : parsed.intent === "event" || kind === "event"
          ? "event"
          : "ticket";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setCreating(true);
    setError("");
    try {
      if (mode === "medication") {
        if (!parsed.title.trim() || parsed.title === "Medication") {
          throw new Error("Could not detect a medication name");
        }
        if (!parsed.medicationId && (!parsed.medTimes || !parsed.medTimes.length)) {
          throw new Error(
            "Could not detect dose times — try “at 8am and 8pm” or “morning and evening”"
          );
        }
        const res = await fetch("/api/meds", {
          method: parsed.medicationId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(parsed.medicationId ? { id: parsed.medicationId } : {}),
            name: parsed.title,
            dosage: parsed.dosage,
            ...(parsed.medTimes?.length ? { times: parsed.medTimes } : {}),
            remindMinutesBefore: parsed.remindMinutesBefore ?? 15,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Could not save medication");
        }
        // Refresh local med list so follow-up edits resolve
        const refreshed = await fetch(
          `/api/meds?tzOffset=${new Date().getTimezoneOffset()}`
        ).then((r) => (r.ok ? r.json() : null));
        setMedications(refreshed?.medications || []);
      } else if (mode === "series") {
        if (!seriesInstances.length) {
          throw new Error("Could not build the schedule — check days and date range");
        }
        const description = parsed.priority
          ? `Priority: ${parsed.priority}`
          : undefined;
        const res = await fetch("/api/events/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsed.title,
            description,
            type: parsed.eventType || "class",
            assigneeId: parsed.assigneeId,
            remindMinutesBefore: parsed.remindMinutesBefore,
            instances: seriesInstances,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Could not create event series");
        }
      } else if (mode === "ticket") {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsed.title,
            status: parsed.status || "Ready",
            priority: parsed.priority || "P2",
            energy: parsed.energy,
            estimateMin: parsed.estimateMin,
            dueAt: parsed.dueAt,
            waitingOn: parsed.waitingOn,
            isFocus: parsed.isFocus,
            projectId: parsed.projectId,
            assigneeId: parsed.assigneeId,
            contactId: parsed.contactId,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Could not create ticket");
        }
      } else {
        if (!parsed.startAt || !parsed.endAt) {
          throw new Error("Could not detect a time — try “tomorrow 5pm”");
        }
        const description = parsed.priority
          ? `Priority: ${parsed.priority}`
          : undefined;
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsed.title,
            description,
            startAt: parsed.startAt,
            endAt: parsed.endAt,
            allDay: parsed.allDay,
            type: parsed.eventType || "personal",
            assigneeId: parsed.assigneeId,
            remindMinutesBefore: parsed.remindMinutesBefore,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Could not create event");
        }
      }
      setDraft("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const chips = [
    mode === "medication" &&
      parsed.medicationId && {
        label: "Update existing",
      },
    mode === "medication" &&
      parsed.dosage && {
        label: parsed.dosage,
      },
    mode === "medication" &&
      parsed.medTimes?.length && {
        label: parsed.medTimes.map(formatMedTime).join(" · "),
      },
    mode === "series" &&
      seriesInstances.length > 0 && {
        label: `${seriesInstances.length} events`,
      },
    mode === "series" &&
      parsed.recurrence && {
        label: weekdayShortLabels(parsed.recurrence.byWeekday),
      },
    mode === "series" &&
      parsed.recurrence && {
        label: format(
          new Date(2000, 0, 1, parsed.recurrence.timeHour, parsed.recurrence.timeMinute),
          "h:mm a"
        ),
      },
    mode === "series" &&
      parsed.untilAt && {
        label: `Until ${format(parseISO(parsed.untilAt), "MMM d, yyyy")}`,
      },
    parsed.remindMinutesBefore != null && {
      label: `Rem ${parsed.remindMinutesBefore}m`,
    },
    parsed.dueAt &&
      mode === "ticket" && {
        label: `Due ${format(parseISO(parsed.dueAt), "MMM d · h:mm a")}`,
      },
    parsed.startAt &&
      mode === "event" && {
        label: parsed.allDay
          ? `All day · ${format(parseISO(parsed.startAt), "MMM d")}`
          : format(parseISO(parsed.startAt), "MMM d · h:mm a"),
      },
    parsed.status && mode === "ticket" && { label: parsed.status },
    parsed.priority && mode !== "medication" && { label: parsed.priority },
    parsed.projectName && { label: `Project · ${parsed.projectName}` },
    parsed.assigneeName && { label: `Owner · ${parsed.assigneeName}` },
    parsed.contactName && { label: `Contact · ${parsed.contactName}` },
    parsed.waitingOn && { label: `Waiting · ${parsed.waitingOn}` },
    parsed.estimateMin && mode === "ticket" && { label: `${parsed.estimateMin} min` },
    parsed.energy && { label: `${parsed.energy} energy` },
    parsed.eventType && mode !== "ticket" && mode !== "medication" && {
      label: parsed.eventType,
    },
    parsed.isFocus && mode === "ticket" && { label: "Focus" },
  ].filter(Boolean) as { label: string }[];

  const submitLabel = creating
    ? mode === "medication"
      ? parsed.medicationId
        ? "Updating…"
        : "Saving…"
      : "Creating…"
    : mode === "medication"
      ? parsed.medicationId
        ? "Update med"
        : "Save med"
      : mode === "series" && seriesInstances.length > 1
        ? `Create ${seriesInstances.length} events`
        : "Create";

  const modeLabel =
    mode === "medication"
      ? "med"
      : mode === "series"
        ? "schedule"
        : mode === "event"
          ? "event"
          : "ticket";

  return (
    <Panel className="relative overflow-hidden">
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
      <form onSubmit={onSubmit} className="relative space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            <Sparkles size={12} />
            Smart {modeLabel}
            {mode === "series" && kind === "ticket" && (
              <span className="font-medium normal-case tracking-normal text-muted">
                (from ticket box)
              </span>
            )}
            {mode === "medication" && kind === "ticket" && (
              <span className="font-medium normal-case tracking-normal text-muted">
                (from ticket box)
              </span>
            )}
          </div>
          {draft.trim() && (
            <span className="text-[10px] text-muted">
              {Math.round(parsed.confidence * 100)}% parsed
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            autoFocus
            placeholder={
              kind === "ticket"
                ? "What's on your mind? Jot it down so you don't forget…"
                : "e.g. Family grocery shopping tomorrow 5pm · or every Mon at 9am for 3 months"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={creating || !draft.trim()}>
            {submitLabel}
          </Button>
        </div>

        {draft.trim() ? (
          <div className="space-y-2">
            <div className="text-xs text-muted">
              Will {mode === "medication" && parsed.medicationId ? "update" : "create"} as{" "}
              <span className="font-semibold text-foreground">
                “{parsed.title}”
              </span>
              {mode === "medication" && parsed.medTimes?.length ? (
                <>
                  {" "}
                  · {parsed.medTimes.length} daily dose
                  {parsed.medTimes.length === 1 ? "" : "s"}
                  {parsed.remindMinutesBefore != null
                    ? ` · ${parsed.remindMinutesBefore}m reminder`
                    : ""}
                </>
              ) : null}
              {mode === "series" && seriesInstances.length > 0 && (
                <>
                  {" "}
                  · {seriesInstances.length} calendar events
                  {parsed.remindMinutesBefore != null
                    ? ` with ${parsed.remindMinutesBefore}m reminders`
                    : ""}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    "rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent"
                  )}
                >
                  {c.label}
                </span>
              ))}
            </div>
            {parsed.hints.length > 0 && (
              <p className="text-[11px] text-muted">
                {parsed.hints.join(" · ")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Time, meds, recurring schedules, reminders, project, owner, and
            priority are detected from your text.
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-danger dark:border-rose-900/40 dark:bg-rose-950/30">
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}
