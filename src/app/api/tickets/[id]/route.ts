import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { spawnRecurringTicket } from "@/lib/recurring-ticket";

type Params = { params: Promise<{ id: string }> };

const detailInclude = {
  project: true,
  contact: true,
  assignee: { select: { id: true, name: true, color: true, image: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, color: true } } },
  },
  checklist: { orderBy: { sortOrder: "asc" as const } },
  reminders: { orderBy: { remindAt: "asc" as const } },
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { user: { select: { id: true, name: true, color: true } } },
  },
  tags: { include: { tag: true } },
};

export async function GET(_req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, householdId },
    include: detailInclude,
  });
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(ticket);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  energy: z.string().optional().nullable(),
  estimateMin: z.number().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  waitingOn: z.string().optional().nullable(),
  isInbox: z.boolean().optional(),
  isFocus: z.boolean().optional(),
  projectId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  recurEveryDays: z.number().int().positive().optional().nullable(),
  recurUntil: z.string().optional().nullable(),
  action: z.enum(["start", "finish"]).optional(),
});

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export async function PATCH(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };
  const { id } = await params;

  const existing = await prisma.ticket.findFirst({ where: { id, householdId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = updateSchema.parse(await req.json());
    const activities: { message: string; userId: string }[] = [];

    let nextStatus = data.status;
    let workStartedAt: Date | null | undefined = undefined;
    let isFocus = data.isFocus;

    if (data.action === "start") {
      nextStatus = "Doing";
      workStartedAt = existing.workStartedAt || new Date();
      isFocus = true;
      activities.push({
        message: existing.workStartedAt
          ? "resumed work"
          : "started working on ticket",
        userId: user.id,
      });
    } else if (data.action === "finish") {
      nextStatus = "Done";
      isFocus = false;
      const started = existing.workStartedAt;
      const duration = started
        ? formatDuration(Date.now() - started.getTime())
        : null;
      workStartedAt = null;
      activities.push({
        message: duration
          ? `finished ticket · worked ${duration}`
          : "finished ticket",
        userId: user.id,
      });
    } else if (nextStatus && nextStatus !== existing.status) {
      activities.push({
        message: `moved ${existing.status} → ${nextStatus}`,
        userId: user.id,
      });
      if (nextStatus === "Doing" && !existing.workStartedAt) {
        workStartedAt = new Date();
      }
      if (
        nextStatus === "Done" ||
        nextStatus === "Backlog" ||
        nextStatus === "Ready" ||
        nextStatus === "Waiting"
      ) {
        if (existing.workStartedAt && nextStatus === "Done") {
          const duration = formatDuration(
            Date.now() - existing.workStartedAt.getTime()
          );
          activities.push({
            message: `worked ${duration}`,
            userId: user.id,
          });
        }
        workStartedAt = null;
      }
    }

    if (data.title && data.title !== existing.title) {
      activities.push({ message: "updated title", userId: user.id });
    }

    if (data.assigneeIds) {
      await prisma.ticketAssignee.deleteMany({ where: { ticketId: id } });
      const primary = data.assigneeIds[0] ?? null;
      const extras = data.assigneeIds.slice(1);
      if (extras.length) {
        await prisma.ticketAssignee.createMany({
          data: extras.map((userId) => ({ ticketId: id, userId })),
        });
      }
      data.assigneeId = primary;
    }

    const {
      action: _action,
      dueAt,
      status: _status,
      isFocus: _focus,
      assigneeIds: _aids,
      recurUntil,
      ...rest
    } = data;

    const becameDone =
      nextStatus === "Done" && existing.status !== "Done";

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...rest,
        status: nextStatus ?? undefined,
        isFocus: isFocus ?? undefined,
        workStartedAt,
        dueAt:
          dueAt === undefined ? undefined : dueAt ? new Date(dueAt) : null,
        recurUntil:
          recurUntil === undefined
            ? undefined
            : recurUntil
              ? new Date(recurUntil)
              : null,
        activities: activities.length ? { create: activities } : undefined,
      },
      include: detailInclude,
    });

    if (becameDone) {
      await spawnRecurringTicket(id, user.id);
    }

    return NextResponse.json(ticket);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const existing = await prisma.ticket.findFirst({ where: { id, householdId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.ticket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
