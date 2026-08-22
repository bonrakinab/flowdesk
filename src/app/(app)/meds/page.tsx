"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Pencil, Pill, Plus, SkipForward, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  note: string | null;
  color: string;
  times: string[];
  active: boolean;
  remindMinutesBefore?: number;
};

type TodayDose = {
  medicationId: string;
  name: string;
  dosage: string | null;
  color: string;
  scheduledFor: string;
  time: string;
  takenAt: string | null;
  skipped: boolean;
};

function tzQuery() {
  return `tzOffset=${new Date().getTimezoneOffset()}`;
}

function parseTimes(text: string) {
  return text
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function MedsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [note, setNote] = useState("");
  const [timesText, setTimesText] = useState("08:00\n20:00");
  const [remindMinutes, setRemindMinutes] = useState("15");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/meds?${tzQuery()}`);
    if (!res.ok) return;
    const data = await res.json();
    setMedications(data.medications);
    setTodayDoses(data.todayDoses);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDosage("");
    setNote("");
    setTimesText("08:00\n20:00");
    setRemindMinutes("15");
    setError("");
  }

  function startEdit(m: Medication) {
    setEditingId(m.id);
    setName(m.name);
    setDosage(m.dosage || "");
    setNote(m.note || "");
    setTimesText((m.times || []).join("\n") || "08:00");
    setRemindMinutes(String(m.remindMinutesBefore ?? 15));
    setError("");
    document.getElementById("med-form")?.scrollIntoView({ behavior: "smooth" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const times = parseTimes(timesText);
    if (!name.trim() || times.length === 0) {
      setError("Name and at least one time are required");
      return;
    }
    const lead = Math.max(0, Math.min(24 * 60, Number(remindMinutes) || 0));
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/meds", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: name.trim(),
          dosage: dosage.trim() || null,
          note: note.trim() || null,
          times,
          remindMinutesBefore: lead,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save medication");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function doseAction(
    medicationId: string,
    scheduledFor: string,
    action: "taken" | "skipped" | "clear"
  ) {
    await fetch("/api/meds/doses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicationId, scheduledFor, action }),
    });
    await load();
  }

  async function removeMed(id: string) {
    if (!confirm("Remove this medication?")) return;
    await fetch("/api/meds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (editingId === id) resetForm();
    await load();
  }

  const now = Date.now();

  return (
    <div className="p-4 md:p-8">
      <div className="page-canvas mx-auto max-w-3xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl flex items-center gap-2">
        <Pill className="text-accent" /> Meds
      </h1>
      <p className="text-sm text-muted mt-1">
        Daily schedule on Calendar · reminder alerts like events (in-app, push,
        email)
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-medium mb-3">Today</h2>
        {todayDoses.length === 0 ? (
          <p className="text-sm text-muted">No doses scheduled for today.</p>
        ) : (
          <ul className="space-y-2">
            {todayDoses.map((d) => {
              const due = parseISO(d.scheduledFor).getTime();
              const overdue = !d.takenAt && !d.skipped && due < now;
              const upcoming =
                !d.takenAt && !d.skipped && due >= now && due - now < 60 * 60_000;
              return (
                <li
                  key={`${d.medicationId}-${d.scheduledFor}`}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3",
                    overdue && "border-rose-300",
                    upcoming && "border-accent/50"
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: d.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {d.name}
                      {d.dosage ? (
                        <span className="text-muted font-normal">
                          {" "}
                          · {d.dosage}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted">
                      {format(parseISO(d.scheduledFor), "h:mm a")}
                      {d.takenAt && " · taken"}
                      {d.skipped && " · skipped"}
                      {overdue && " · overdue"}
                    </div>
                  </div>
                  {!d.takenAt && !d.skipped ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() =>
                          doseAction(d.medicationId, d.scheduledFor, "taken")
                        }
                      >
                        <Check size={14} /> Take
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          doseAction(d.medicationId, d.scheduledFor, "skipped")
                        }
                      >
                        <SkipForward size={14} /> Skip
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        doseAction(d.medicationId, d.scheduledFor, "clear")
                      }
                    >
                      Undo
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form
        id="med-form"
        onSubmit={onSubmit}
        className="mt-8 rounded-2xl border border-border bg-card p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium flex items-center gap-2">
            {editingId ? (
              <>
                <Pencil size={16} /> Edit medication
              </>
            ) : (
              <>
                <Plus size={16} /> Add medication
              </>
            )}
          </h2>
          {editingId && (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              <X size={14} /> Cancel
            </Button>
          )}
        </div>
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Metformin"
            required
          />
        </div>
        <div>
          <Label>Dosage (optional)</Label>
          <Input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="500mg with food"
          />
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Take with breakfast"
          />
        </div>
        <div>
          <Label>Times (one per line, 24h HH:mm)</Label>
          <textarea
            className="field-control w-full min-h-20 rounded-xl border border-border/90 px-3.5 py-2.5 text-sm"
            value={timesText}
            onChange={(e) => setTimesText(e.target.value)}
            placeholder={"08:00\n20:00"}
          />
        </div>
        <div>
          <Label>Remind me (minutes before)</Label>
          <Input
            type="number"
            min={0}
            max={1440}
            inputMode="numeric"
            value={remindMinutes}
            onChange={(e) => setRemindMinutes(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted">
            0 = alert only at dose time. Default 15 fires a reminder like events.
          </p>
        </div>
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-danger dark:border-rose-900/40 dark:bg-rose-950/30">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update" : "Save"}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <section className="mt-8 space-y-2">
        <h2 className="text-sm font-medium">All medications</h2>
        {medications.length === 0 && (
          <p className="text-sm text-muted">None yet.</p>
        )}
        {medications.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3",
              editingId === m.id && "border-accent/50"
            )}
          >
            <span
              className="mt-1.5 h-3 w-3 rounded-full shrink-0"
              style={{ background: m.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted">
                {m.dosage || "No dosage note"} · {m.times.join(", ")}
                {typeof m.remindMinutesBefore === "number" &&
                  ` · remind ${m.remindMinutesBefore}m before`}
              </div>
              {m.note && (
                <div className="mt-1 text-xs text-muted">{m.note}</div>
              )}
            </div>
            <button
              type="button"
              className="text-muted hover:text-accent p-1"
              onClick={() => startEdit(m)}
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="text-muted hover:text-danger p-1"
              onClick={() => removeMed(m.id)}
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
      </div>
    </div>
  );
}
