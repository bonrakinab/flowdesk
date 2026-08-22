import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { startOfDay, startOfWeek } from "date-fns";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const sessions = await prisma.pomodoroSession.findMany({
    where: { userId: user.id },
    include: { ticket: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const today = startOfDay(new Date());
  const week = startOfWeek(new Date(), { weekStartsOn: 1 });
  const completedToday = sessions.filter(
    (s) => s.completed && s.endedAt && s.endedAt >= today
  );
  const completedWeek = await prisma.pomodoroSession.findMany({
    where: {
      userId: user.id,
      completed: true,
      endedAt: { gte: week },
    },
  });

  return NextResponse.json({
    sessions,
    stats: {
      sessionsToday: completedToday.length,
      focusMinutesWeek: completedWeek.reduce((a, s) => a + s.workMinutes, 0),
    },
  });
}

const schema = z.object({
  workMinutes: z.number().optional(),
  breakMinutes: z.number().optional(),
  ticketId: z.string().optional().nullable(),
  status: z.string().optional(),
  phase: z.string().optional(),
  completed: z.boolean().optional(),
  id: z.string().optional(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };
  const data = schema.parse(await req.json());

  if (data.ticketId) {
    await prisma.ticket.updateMany({
      where: { id: data.ticketId, status: { in: ["Backlog", "Ready"] } },
      data: { status: "Doing" },
    });
  }

  const session = await prisma.pomodoroSession.create({
    data: {
      userId: user.id,
      workMinutes: data.workMinutes ?? 25,
      breakMinutes: data.breakMinutes ?? 5,
      ticketId: data.ticketId,
      status: "running",
      phase: "work",
      startedAt: new Date(),
    },
    include: { ticket: { select: { id: true, title: true } } },
  });
  return NextResponse.json(session);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };
  const data = schema.parse(await req.json());
  if (!data.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.pomodoroSession.findFirst({
    where: { id: data.id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await prisma.pomodoroSession.update({
    where: { id: data.id },
    data: {
      status: data.status,
      phase: data.phase,
      completed: data.completed,
      endedAt: data.completed || data.status === "done" ? new Date() : undefined,
    },
    include: { ticket: { select: { id: true, title: true } } },
  });
  return NextResponse.json(session);
}
