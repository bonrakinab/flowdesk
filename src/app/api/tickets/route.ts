import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { TICKET_STATUSES } from "@/lib/utils";

const ticketInclude = {
  project: true,
  contact: true,
  assignee: { select: { id: true, name: true, color: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, color: true } } },
  },
  tags: { include: { tag: true } },
  checklist: { orderBy: { sortOrder: "asc" as const } },
  reminders: { where: { done: false }, orderBy: { remindAt: "asc" as const } },
  _count: { select: { activities: true } },
};

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const inbox = searchParams.get("inbox");
  const mine = searchParams.get("mine");
  const projectId = searchParams.get("projectId");
  const tagId = searchParams.get("tagId");
  const assigneeId = searchParams.get("assigneeId");

  const tickets = await prisma.ticket.findMany({
    where: {
      householdId,
      ...(status ? { status } : {}),
      ...(inbox === "1"
        ? { isInbox: true }
        : inbox === "0"
          ? { isInbox: false }
          : {}),
      ...(mine === "1"
        ? {
            OR: [
              { assigneeId: user.id },
              { assignees: { some: { userId: user.id } } },
            ],
          }
        : {}),
      ...(assigneeId
        ? {
            OR: [
              { assigneeId },
              { assignees: { some: { userId: assigneeId } } },
            ],
          }
        : {}),
      ...(projectId ? { projectId } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    },
    include: ticketInclude,
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json(tickets);
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
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
  tagIds: z.array(z.string()).optional(),
  recurEveryDays: z.number().int().positive().optional().nullable(),
  recurUntil: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  try {
    const data = createSchema.parse(await req.json());
    const primary =
      data.assigneeId ?? data.assigneeIds?.[0] ?? user.id;
    const extraIds = (data.assigneeIds || []).filter((id) => id !== primary);

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type || "task",
        status:
          data.status && TICKET_STATUSES.includes(data.status as never)
            ? data.status
            : data.isInbox
              ? "Backlog"
              : "Ready",
        priority: data.priority || "P2",
        energy: data.energy,
        estimateMin: data.estimateMin,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        waitingOn: data.waitingOn,
        isInbox: data.isInbox ?? false,
        isFocus: data.isFocus ?? false,
        projectId: data.projectId,
        contactId: data.contactId,
        assigneeId: primary,
        createdById: user.id,
        householdId,
        recurEveryDays: data.recurEveryDays ?? null,
        recurUntil: data.recurUntil ? new Date(data.recurUntil) : null,
        assignees: extraIds.length
          ? { create: extraIds.map((userId) => ({ userId })) }
          : undefined,
        tags: data.tagIds?.length
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        activities: {
          create: {
            message: "created ticket",
            userId: user.id,
          },
        },
      },
      include: ticketInclude,
    });
    return NextResponse.json(ticket);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
