"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, Inbox as InboxIcon, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  Select,
  StatChip,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { priorityGlowClass, priorityBadgeClass } from "@/lib/priority";

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  priority?: string;
  status?: string;
};

type Project = {
  id: string;
  name: string;
  color: string;
};

export default function InboxPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [triageProject, setTriageProject] = useState<Record<string, string>>(
    {}
  );

  const load = useCallback(async () => {
    const [tRes, pRes] = await Promise.all([
      fetch("/api/tickets?inbox=1"),
      fetch("/api/projects"),
    ]);
    if (tRes.ok) setTickets(await tRes.json());
    if (pRes.ok) setProjects(await pRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCapture(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCapturing(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), isInbox: true }),
    });
    setCapturing(false);
    if (res.ok) {
      const ticket = await res.json();
      setTickets((prev) => [ticket, ...prev]);
      setTitle("");
    }
  }

  async function triage(id: string) {
    const projectId = triageProject[id] || null;
    setTickets((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isInbox: false,
        status: "Ready",
        ...(projectId ? { projectId } : {}),
      }),
    });
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Capture"
          title="Inbox"
          description="A parking lot for quick thoughts and tasks — capture now, assign to a project later. Not connected to email."
        />

        <div className="mb-6 grid grid-cols-2 gap-3">
          <StatChip label="Waiting triage" value={tickets.length} />
          <StatChip label="Projects ready" value={projects.length} />
        </div>

        <Panel className="mb-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
          <form onSubmit={onCapture} className="relative">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              <Sparkles size={12} />
              Quick capture
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="What's on your mind?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="sm:flex-1 text-base py-3"
              />
              <Button
                type="submit"
                size="lg"
                disabled={capturing || !title.trim()}
              >
                {capturing ? "Adding…" : "Capture"}
              </Button>
            </div>
          </form>
        </Panel>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-3xl bg-stone-200/50"
              />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<InboxIcon size={22} />}
            title="Inbox zero"
            description="Inbox is empty."
          />
        ) : (
          <ul className="space-y-3">
            {tickets.map((t) => (
              <li key={t.id}>
                <Panel
                  className={cn(
                    "!p-0 overflow-visible",
                    priorityGlowClass(t.priority, {
                      done: t.status === "Done",
                    })
                  )}
                >
                  <div className="flex">
                    <div className="w-1.5 shrink-0 bg-warm" />
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/tickets/${t.id}`}
                            className="font-[family-name:var(--font-display)] text-lg tracking-tight hover:text-accent"
                          >
                            {t.title}
                          </Link>
                          {t.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted">
                              {t.description}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge tone="warm">Inbox</Badge>
                            {t.priority && (
                              <Badge className={priorityBadgeClass(t.priority)}>
                                {t.priority}
                              </Badge>
                            )}
                            <span className="text-xs text-muted">
                              {format(parseISO(t.createdAt), "MMM d · h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center">
                        <Select
                          value={triageProject[t.id] || ""}
                          onChange={(e) =>
                            setTriageProject((prev) => ({
                              ...prev,
                              [t.id]: e.target.value,
                            }))
                          }
                          className="sm:max-w-xs"
                        >
                          <option value="">No project</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                        <Button
                          variant="soft"
                          className="sm:ml-auto"
                          onClick={() => triage(t.id)}
                        >
                          Triage to Ready
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
