import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

function appendNote(existing: string | null | undefined, note: string) {
  const base = (existing || "").trim();
  return base ? `${base}\n\n${note}` : note;
}

export async function PATCH(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, householdId },
    include: { reminders: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    allDay: z.boolean().optional(),
    type: z.string().optional(),
    color: z.string().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    status: z.enum(["scheduled", "done", "postponed"]).optional(),
    action: z.enum(["finish_early", "postpone"]).optional(),
    /** Minutes to shift the event when postponing */
    postponeMinutes: z.number().int().min(1).max(60 * 24 * 30).optional(),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  });

  const data = schema.parse(await req.json());

  if (data.action === "finish_early") {
    const now = new Date();
    const startAt = existing.startAt;
    const endAt = existing.endAt;
    let newEnd = now;
    if (now.getTime() <= startAt.getTime()) {
      // Before it started — mark done and collapse to a short completed block
      newEnd = startAt;
    } else if (now.getTime() >= endAt.getTime()) {
      newEnd = endAt;
    }

    const stamp = now.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        endAt: newEnd,
        status: "done",
        description: appendNote(
          existing.description,
          `Finished early · ${stamp}`
        ),
      },
    });

    // Clear upcoming reminders for a finished event
    if (existing.reminders.length) {
      await prisma.reminder.updateMany({
        where: {
          eventId: id,
          done: false,
          remindAt: { gt: now },
        },
        data: { done: true },
      });
    }

    return NextResponse.json(event);
  }

  if (data.action === "postpone") {
    const minutes = data.postponeMinutes ?? 60;
    const shiftMs = minutes * 60_000;
    const newStart = new Date(existing.startAt.getTime() + shiftMs);
    const duration = Math.max(
      0,
      existing.endAt.getTime() - existing.startAt.getTime()
    );
    const newEnd = new Date(newStart.getTime() + duration);

    const label =
      minutes < 60
        ? `+${minutes}m`
        : minutes % (24 * 60) === 0
          ? `+${minutes / (24 * 60)}d`
          : minutes % 60 === 0
            ? `+${minutes / 60}h`
            : `+${minutes}m`;

    const stamp = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.calendarEvent.update({
        where: { id },
        data: {
          startAt: newStart,
          endAt: newEnd,
          status: "postponed",
          description: appendNote(
            existing.description,
            `Postponed ${label} · ${stamp}`
          ),
        },
      });

      for (const rem of existing.reminders) {
        if (rem.done) continue;
        await tx.reminder.update({
          where: { id: rem.id },
          data: {
            remindAt: new Date(rem.remindAt.getTime() + shiftMs),
          },
        });
      }

      return updated;
    });

    return NextResponse.json(event);
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      allDay: data.allDay,
      type: data.type,
      color: data.color,
      assigneeId: data.assigneeId,
      status: data.status,
      priority: data.priority,
      startAt: data.startAt ? new Date(data.startAt) : undefined,
      endAt: data.endAt ? new Date(data.endAt) : undefined,
    },
  });
  return NextResponse.json(event);
}

export async function DELETE(_req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, householdId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
