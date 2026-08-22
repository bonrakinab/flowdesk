"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import { Badge, Input } from "@/components/ui/primitives";
import { cn, PRIORITIES, TICKET_STATUSES } from "@/lib/utils";
import { priorityGlowClass, priorityBadgeClass } from "@/lib/priority";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assignee: { name: string | null; color: string } | null;
  project: { name: string; color: string } | null;
  updatedAt: string;
};

type SortKey = "title" | "status" | "priority" | "dueAt" | "updatedAt";

const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export default function ListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/tickets?${params}`);
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (priorityFilter) {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "priority") {
        cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      } else if (sortKey === "dueAt") {
        const da = a.dueAt ? parseISO(a.dueAt).getTime() : Infinity;
        const db = b.dueAt ? parseISO(b.dueAt).getTime() : Infinity;
        cmp = da - db;
      } else if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      } else {
        cmp = parseISO(a.updatedAt).getTime() - parseISO(b.updatedAt).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [tickets, priorityFilter, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            List
          </h1>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field-control rounded-xl border border-border px-3 py-2 text-sm text-foreground"
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="field-control rounded-xl border border-border px-3 py-2 text-sm text-foreground"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                {(
                  [
                    ["title", "Title"],
                    ["status", "Status"],
                    ["priority", "Priority"],
                    ["dueAt", "Due"],
                    ["updatedAt", "Updated"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Project</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border/60 transition hover:bg-warm-soft/30"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/tickets/${t.id}`}
                      className={cn(
                        "inline-flex rounded-lg px-1.5 py-0.5 font-medium hover:text-accent",
                        priorityGlowClass(t.priority, {
                          done: t.status === "Done",
                        })
                      )}
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={priorityBadgeClass(t.priority)}>
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {t.dueAt ? format(parseISO(t.dueAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {format(parseISO(t.updatedAt), "MMM d")}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.assignee ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: t.assignee.color }}
                        />
                        {t.assignee.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.project ? (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `${t.project.color}22` }}
                      >
                        {t.project.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No tickets match your filters
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
