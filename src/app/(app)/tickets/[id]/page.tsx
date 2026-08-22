"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, CheckCircle2, Clock, Play, Plus, Trash2 } from "lucide-react";
import { usePomodoro } from "@/components/pomodoro/pomodoro-provider";
import { TicketHourglass } from "@/components/ticket/ticket-hourglass";
import {
  Badge,
  Button,
  Field,
  Input,
  Panel,
  PanelHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { cn, TICKET_STATUSES } from "@/lib/utils";
import { playTaskCompleteTone } from "@/lib/sounds";
import { PriorityPicker } from "@/components/priority/priority-picker";
import {
  priorityGlowClass,
  priorityBadgeClass,
  type Priority,
} from "@/lib/priority";

type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

type Activity = {
  id: string;
  message: string;
  createdAt: string;
  user: { name: string | null; color: string } | null;
};

type Reminder = {
  id: string;
  title: string | null;
  remindAt: string;
  done: boolean;
};

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  energy: string | null;
  estimateMin: number | null;
  dueAt: string | null;
  waitingOn: string | null;
  workStartedAt?: string | null;
  projectId: string | null;
  contactId: string | null;
  assigneeId: string | null;
  recurEveryDays?: number | null;
  recurUntil?: string | null;
  project: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  assignee: { id: string; name: string | null; color: string } | null;
  assignees?: { user: { id: string; name: string | null; color: string } }[];
  tags?: { tag: { id: string; name: string; color: string } }[];
  checklist: ChecklistItem[];
  reminders: Reminder[];
  activities: Activity[];
};

type User = { id: string; name: string | null; color: string };
type Project = { id: string; name: string };
type Contact = { id: string; name: string };

const ENERGY_LEVELS = ["low", "medium", "high"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pomo = usePomodoro();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allTags, setAllTags] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [newTagName, setNewTagName] = useState("");
  const [newChecklist, setNewChecklist] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [tRes, hRes, pRes, cRes, tagRes] = await Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch("/api/household"),
      fetch("/api/projects"),
      fetch("/api/contacts"),
      fetch("/api/tags"),
    ]);
    if (tRes.ok) setTicket(await tRes.json());
    if (hRes.ok) {
      const h = await hRes.json();
      setUsers(h.users || []);
    }
    if (pRes.ok) setProjects(await pRes.json());
    if (cRes.ok) setContacts(await cRes.json());
    if (tagRes.ok) setAllTags(await tagRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (data: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
      load();
    }
  };

  const addChecklist = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChecklist.trim()) return;
    const res = await fetch(`/api/tickets/${id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newChecklist.trim() }),
    });
    if (res.ok) {
      const item = await res.json();
      setTicket((prev) =>
        prev ? { ...prev, checklist: [...prev.checklist, item] } : prev
      );
      setNewChecklist("");
    }
  };

  const toggleChecklist = async (itemId: string, done: boolean) => {
    setTicket((prev) =>
      prev
        ? {
            ...prev,
            checklist: prev.checklist.map((c) =>
              c.id === itemId ? { ...c, done } : c
            ),
          }
        : prev
    );
    await fetch(`/api/tickets/${id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, done }),
    });
  };

  const addReminder = async (e: FormEvent) => {
    e.preventDefault();
    if (!reminderAt) return;
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: id,
        remindAt: new Date(reminderAt).toISOString(),
        title: reminderTitle || ticket?.title,
      }),
    });
    if (res.ok) {
      const reminder = await res.json();
      setTicket((prev) =>
        prev ? { ...prev, reminders: [...prev.reminders, reminder] } : prev
      );
      setReminderAt("");
      setReminderTitle("");
    }
  };

  const deleteTicket = async () => {
    if (!confirm("Delete this ticket permanently?")) return;
    await fetch(`/api/tickets/${id}`, { method: "DELETE" });
    router.push("/list");
  };

  const startWork = async () => {
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    setSaving(false);
    if (res.ok) {
      setTicket(await res.json());
    }
  };

  const finishWork = async () => {
    // Play during the click gesture (before await) so browsers allow audio
    playTaskCompleteTone();
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish" }),
    });
    setSaving(false);
    if (res.ok) {
      setTicket(await res.json());
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-8 w-40 rounded-xl bg-stone-200/70" />
          <div className="h-56 rounded-3xl bg-stone-200/50" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="px-4 py-8 md:px-8">
        <p className="text-sm text-muted">Ticket not found</p>
        <Link href="/list" className="mt-2 inline-block text-accent">
          Back to list
        </Link>
      </div>
    );
  }

  const doneCount = ticket.checklist.filter((c) => c.done).length;

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/list"
            className="text-sm text-muted transition hover:text-accent"
          >
            ← Back to list
          </Link>
          <div className="flex flex-wrap gap-2">
            {saving && (
              <span className="self-center text-xs text-muted">Saving…</span>
            )}
            {ticket.workStartedAt && (
              <div className="flex items-center rounded-xl border border-warm/30 bg-warm-soft px-3 py-1.5">
                <TicketHourglass
                  startedAt={ticket.workStartedAt}
                  estimateMin={ticket.estimateMin}
                />
              </div>
            )}
            {ticket.status !== "Done" && !ticket.workStartedAt && (
              <Button variant="secondary" onClick={startWork}>
                <Play size={14} />
                Start work
              </Button>
            )}
            {ticket.status !== "Done" && (
              <Button variant="primary" onClick={finishWork}>
                <CheckCircle2 size={14} />
                Finish task
              </Button>
            )}
            {ticket.status === "Done" && (
              <Badge tone="success">Completed</Badge>
            )}
            <Button
              variant="soft"
              onClick={() =>
                pomo.start({
                  ticketId: ticket.id,
                  ticketTitle: ticket.title,
                })
              }
            >
              <Play size={14} />
              Pomodoro
            </Button>
            <Button variant="ghost" onClick={deleteTicket}>
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5">
            <Panel
              className={cn(
                "!p-0 overflow-visible",
                priorityGlowClass(ticket.priority, {
                  done: ticket.status === "Done",
                })
              )}
            >
              <div className="border-b border-border/70 bg-gradient-to-br from-white via-card to-accent-soft/30 px-5 py-5 md:px-7 md:py-7">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge className={priorityBadgeClass(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                  <Badge tone="accent">{ticket.status}</Badge>
                  {ticket.project && <Badge>{ticket.project.name}</Badge>}
                </div>
                <Input
                  value={ticket.title}
                  onChange={(e) =>
                    setTicket({ ...ticket, title: e.target.value })
                  }
                  onBlur={() => patch({ title: ticket.title })}
                  className="border-0 bg-transparent px-0 font-[family-name:var(--font-display)] text-2xl md:text-3xl shadow-none focus:ring-0"
                />
                <Textarea
                  value={ticket.description || ""}
                  onChange={(e) =>
                    setTicket({ ...ticket, description: e.target.value })
                  }
                  onBlur={() => patch({ description: ticket.description })}
                  placeholder="Add notes…"
                  className="mt-3 min-h-28 border-0 bg-transparent px-0 shadow-none focus:ring-0"
                />
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Checklist"
                description={
                  ticket.checklist.length
                    ? `${doneCount} of ${ticket.checklist.length} complete`
                    : undefined
                }
              />
              <ul className="space-y-2">
                {ticket.checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/50 px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleChecklist(item.id, !item.done)}
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition",
                        item.done
                          ? "border-accent bg-accent text-white"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      {item.done && <Check size={13} />}
                    </button>
                    <span
                      className={cn(
                        "text-sm",
                        item.done && "text-muted line-through"
                      )}
                    >
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
              <form onSubmit={addChecklist} className="mt-4 flex gap-2">
                <Input
                  placeholder="Add checklist item…"
                  value={newChecklist}
                  onChange={(e) => setNewChecklist(e.target.value)}
                />
                <Button type="submit" variant="secondary" size="icon">
                  <Plus size={16} />
                </Button>
              </form>
            </Panel>

            <Panel>
              <PanelHeader title="Activity" />
              <ul className="space-y-3">
                {ticket.activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl text-[11px] font-semibold text-white"
                      style={{ background: a.user?.color || "#78716c" }}
                    >
                      {(a.user?.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div>
                        <span className="font-semibold">
                          {a.user?.name || "Someone"}
                        </span>{" "}
                        <span className="text-muted">{a.message}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {format(parseISO(a.createdAt), "MMM d · h:mm a")}
                      </div>
                    </div>
                  </li>
                ))}
                {ticket.activities.length === 0 && (
                  <p className="text-sm text-muted">No activity yet</p>
                )}
              </ul>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel>
              <PanelHeader title="Details" />
              <div className="space-y-3.5">
                <Field label="Status">
                  <Select
                    value={ticket.status}
                    onChange={(e) => {
                      const status = e.target.value;
                      setTicket({ ...ticket, status });
                      patch({ status });
                    }}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority">
                  <PriorityPicker
                    value={ticket.priority}
                    onChange={(priority: Priority) => {
                      setTicket({ ...ticket, priority });
                      patch({ priority });
                    }}
                  />
                </Field>
                <Field label="Energy">
                  <Select
                    value={ticket.energy || ""}
                    onChange={(e) => {
                      const energy = e.target.value || null;
                      setTicket({ ...ticket, energy });
                      patch({ energy });
                    }}
                  >
                    <option value="">—</option>
                    {ENERGY_LEVELS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due date">
                  <Input
                    type="datetime-local"
                    value={
                      ticket.dueAt
                        ? format(parseISO(ticket.dueAt), "yyyy-MM-dd'T'HH:mm")
                        : ""
                    }
                    onChange={(e) => {
                      const dueAt = e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null;
                      setTicket({ ...ticket, dueAt });
                      patch({ dueAt });
                    }}
                  />
                </Field>
                <Field label="Waiting on">
                  <Input
                    value={ticket.waitingOn || ""}
                    onChange={(e) =>
                      setTicket({ ...ticket, waitingOn: e.target.value })
                    }
                    onBlur={() =>
                      patch({ waitingOn: ticket.waitingOn || null })
                    }
                    placeholder="Person or blocker…"
                  />
                </Field>
                <Field label="Estimate (min)">
                  <Input
                    type="number"
                    min={0}
                    value={ticket.estimateMin ?? ""}
                    onChange={(e) =>
                      setTicket({
                        ...ticket,
                        estimateMin: e.target.value
                          ? parseInt(e.target.value, 10)
                          : null,
                      })
                    }
                    onBlur={() => patch({ estimateMin: ticket.estimateMin })}
                  />
                </Field>
                <Field label="Assignee">
                  <Select
                    value={ticket.assigneeId || ""}
                    onChange={(e) => {
                      const assigneeId = e.target.value || null;
                      setTicket({ ...ticket, assigneeId });
                      patch({ assigneeId });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || "Member"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Also assigned">
                  <div className="flex flex-wrap gap-2">
                    {users.map((u) => {
                      const checked =
                        ticket.assigneeId === u.id ||
                        ticket.assignees?.some((a) => a.user.id === u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-2 py-1"
                        >
                          <input
                            type="checkbox"
                            checked={!!checked}
                            onChange={() => {
                              const ids = new Set<string>();
                              if (ticket.assigneeId) ids.add(ticket.assigneeId);
                              ticket.assignees?.forEach((a) =>
                                ids.add(a.user.id)
                              );
                              if (ids.has(u.id)) ids.delete(u.id);
                              else ids.add(u.id);
                              void patch({ assigneeIds: [...ids] });
                            }}
                          />
                          {u.name || "Member"}
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Tags">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ticket.tags?.map((t) => (
                      <button
                        key={t.tag.id}
                        type="button"
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background: `${t.tag.color}22`,
                          color: t.tag.color,
                        }}
                        onClick={async () => {
                          await fetch(`/api/tickets/${id}/tags`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tagId: t.tag.id }),
                          });
                          await load();
                        }}
                        title="Remove tag"
                      >
                        {t.tag.name} ×
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Add tag"
                      list="ticket-tags"
                    />
                    <datalist id="ticket-tags">
                      {allTags.map((t) => (
                        <option key={t.id} value={t.name} />
                      ))}
                    </datalist>
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      onClick={async () => {
                        if (!newTagName.trim()) return;
                        await fetch(`/api/tickets/${id}/tags`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ tagName: newTagName.trim() }),
                        });
                        setNewTagName("");
                        await load();
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </Field>
                <Field label="Repeat every (days)">
                  <Input
                    type="number"
                    min={0}
                    value={ticket.recurEveryDays ?? ""}
                    onChange={(e) =>
                      setTicket({
                        ...ticket,
                        recurEveryDays: e.target.value
                          ? parseInt(e.target.value, 10)
                          : null,
                      })
                    }
                    onBlur={() =>
                      patch({
                        recurEveryDays: ticket.recurEveryDays || null,
                      })
                    }
                    placeholder="e.g. 7 for weekly"
                  />
                </Field>
                <Field label="Repeat until">
                  <Input
                    type="date"
                    value={
                      ticket.recurUntil
                        ? format(parseISO(ticket.recurUntil), "yyyy-MM-dd")
                        : ""
                    }
                    onChange={(e) => {
                      const recurUntil = e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null;
                      setTicket({ ...ticket, recurUntil });
                      patch({ recurUntil });
                    }}
                  />
                </Field>
                <Field label="Project">
                  <Select
                    value={ticket.projectId || ""}
                    onChange={(e) => {
                      const projectId = e.target.value || null;
                      setTicket({ ...ticket, projectId });
                      patch({ projectId });
                    }}
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Contact">
                  <Select
                    value={ticket.contactId || ""}
                    onChange={(e) => {
                      const contactId = e.target.value || null;
                      setTicket({ ...ticket, contactId });
                      patch({ contactId });
                    }}
                  >
                    <option value="">None</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Reminders" />
              <ul className="mb-4 space-y-2">
                {ticket.reminders.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-white/50 px-3 py-2 text-sm"
                  >
                    <Clock size={14} className="text-warm" />
                    <span className="min-w-0 flex-1 truncate">
                      {r.title || "Reminder"}
                    </span>
                    <span className="text-xs text-muted">
                      {format(parseISO(r.remindAt), "MMM d, h:mm a")}
                    </span>
                    {r.done && <Badge tone="success">Done</Badge>}
                  </li>
                ))}
                {ticket.reminders.length === 0 && (
                  <p className="text-sm text-muted">No reminders yet</p>
                )}
              </ul>
              <form onSubmit={addReminder} className="space-y-2">
                <Input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)}
                  required
                />
                <Input
                  placeholder="Label (optional)"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                />
                <Button type="submit" variant="secondary" className="w-full">
                  Add reminder
                </Button>
              </form>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
