"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge, Select } from "@/components/ui/primitives";
import { TicketHourglass } from "@/components/ticket/ticket-hourglass";
import { cn, TICKET_STATUSES, type TicketStatus } from "@/lib/utils";
import { playTaskCompleteTone } from "@/lib/sounds";
import { priorityGlowClass, priorityBadgeClass } from "@/lib/priority";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  estimateMin?: number | null;
  workStartedAt?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  assignee: { id?: string; name: string | null; color: string } | null;
  project: { id?: string; name: string; color: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
  assignees?: { user: { id: string; name: string | null; color: string } }[];
};

function TicketCard({ ticket, dragging }: { ticket: Ticket; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm transition",
        dragging && "opacity-50 ring-2 ring-accent/30",
        priorityGlowClass(ticket.priority, { done: ticket.status === "Done" })
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/tickets/${ticket.id}`}
          className="block min-w-0 flex-1 text-sm font-medium leading-snug hover:text-accent"
          onClick={(e) => dragging && e.preventDefault()}
        >
          {ticket.title}
        </Link>
        {ticket.workStartedAt && (
          <TicketHourglass
            startedAt={ticket.workStartedAt}
            estimateMin={ticket.estimateMin}
            compact
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge className={priorityBadgeClass(ticket.priority)}>
          {ticket.priority}
        </Badge>
        {ticket.project && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `${ticket.project.color}22` }}
          >
            {ticket.project.name}
          </span>
        )}
        {ticket.tags?.map((t) => (
          <span
            key={t.tag.id}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: `${t.tag.color}22`, color: t.tag.color }}
          >
            {t.tag.name}
          </span>
        ))}
      </div>
      {ticket.assignee && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: ticket.assignee.color }}
          />
          {ticket.assignee.name}
          {(ticket.assignees?.length || 0) > 0 && (
            <span>+{ticket.assignees!.length}</span>
          )}
        </div>
      )}
    </div>
  );
}

function DraggableTicket({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.id, data: { ticket } });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TicketCard ticket={ticket} dragging={isDragging} />
    </div>
  );
}

function Column({
  status,
  tickets,
}: {
  status: TicketStatus;
  tickets: Ticket[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-black/[0.02] p-3",
        isOver && "border-accent/50 bg-accent/5"
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{status}</h2>
        <Badge>{tickets.length}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin max-h-[calc(100vh-12rem)]">
        {tickets.map((t) => (
          <DraggableTicket key={t.id} ticket={t} />
        ))}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<
    { id: string; name: string | null }[]
  >([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [filterProject, setFilterProject] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tickets?inbox=0");
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
    void fetch("/api/household")
      .then((r) => r.json())
      .then((h) => setMembers(h.users || []))
      .catch(() => {});
    void fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filterProject && t.projectId !== filterProject) return false;
      if (filterAssignee) {
        const primary = t.assigneeId === filterAssignee;
        const co = t.assignees?.some((a) => a.user.id === filterAssignee);
        if (!primary && !co) return false;
      }
      if (filterTag && !t.tags?.some((x) => x.tag.id === filterTag))
        return false;
      return true;
    });
  }, [tickets, filterProject, filterAssignee, filterTag]);

  const byStatus = (status: TicketStatus) =>
    filtered.filter((t) => t.status === status);

  const onDragStart = (e: DragStartEvent) => {
    const ticket = e.active.data.current?.ticket as Ticket | undefined;
    if (ticket) setActive(ticket);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const ticketId = e.active.id as string;
    const newStatus = e.over?.id as TicketStatus | undefined;
    if (!newStatus || !TICKET_STATUSES.includes(newStatus)) return;

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );

    if (newStatus === "Done") {
      playTaskCompleteTone();
    }

    await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Board
          </h1>
          <p className="mt-1 text-sm text-muted">
            Drag between columns · filter by project, person, or tag
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-36"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="w-36"
          >
            <option value="">All people</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || "Member"}
              </option>
            ))}
          </Select>
          <Select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="w-36"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading board…</p>
      ) : (
        <DndContext
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
            {TICKET_STATUSES.map((status) => (
              <Column key={status} status={status} tickets={byStatus(status)} />
            ))}
          </div>
          <DragOverlay>
            {active ? <TicketCard ticket={active} /> : null}
          </DragOverlay>
        </DndContext>
      )}
      </div>
    </div>
  );
}
