import { addDays } from "date-fns";
import { prisma } from "@/lib/db";

export async function spawnRecurringTicket(
  ticketId: string,
  userId: string
) {
  const existing = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      checklist: { orderBy: { sortOrder: "asc" } },
      tags: true,
      assignees: true,
    },
  });
  if (!existing?.recurEveryDays || existing.recurEveryDays < 1) return null;

  const baseDue = existing.dueAt || new Date();
  const nextDue = addDays(baseDue, existing.recurEveryDays);
  if (existing.recurUntil && nextDue > existing.recurUntil) return null;

  const next = await prisma.ticket.create({
    data: {
      title: existing.title,
      description: existing.description,
      type: existing.type,
      status: "Ready",
      priority: existing.priority,
      energy: existing.energy,
      estimateMin: existing.estimateMin,
      dueAt: nextDue,
      waitingOn: existing.waitingOn,
      isInbox: false,
      isFocus: false,
      recurEveryDays: existing.recurEveryDays,
      recurUntil: existing.recurUntil,
      parentTicketId: existing.id,
      householdId: existing.householdId,
      projectId: existing.projectId,
      contactId: existing.contactId,
      assigneeId: existing.assigneeId,
      createdById: userId,
      checklist: {
        create: existing.checklist.map((c, i) => ({
          title: c.title,
          sortOrder: i,
          done: false,
        })),
      },
      tags: {
        create: existing.tags.map((t) => ({ tagId: t.tagId })),
      },
      assignees: {
        create: existing.assignees.map((a) => ({ userId: a.userId })),
      },
      activities: {
        create: {
          message: `spawned from recurring ticket ${existing.id.slice(0, 8)}`,
          userId,
        },
      },
    },
  });

  await prisma.activity.create({
    data: {
      ticketId: existing.id,
      userId,
      message: `spawned next recurring ticket due ${nextDue.toISOString().slice(0, 10)}`,
    },
  });

  return next;
}
