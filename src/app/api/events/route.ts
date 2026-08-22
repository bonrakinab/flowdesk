import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const events = await prisma.calendarEvent.findMany({
    where: {
      householdId,
      ...(from && to
        ? {
            OR: [
              {
                AND: [
                  { startAt: { lte: new Date(to) } },
                  { endAt: { gte: new Date(from) } },
                ],
              },
              // Catch zero-duration / broken end times from bad ICS imports
              {
                AND: [
                  { startAt: { gte: new Date(from) } },
                  { startAt: { lte: new Date(to) } },
                ],
              },
            ],
          }
        : {}),
    },
    include: { reminders: true },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(events);
}

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean().optional(),
  type: z.string().optional(),
  color: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  calendarId: z.string().optional().nullable(),
  remindMinutesBefore: z.number().optional().nullable(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  try {
    const data = schema.parse(await req.json());
    const startAt = new Date(data.startAt);
    const event = await prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description,
        startAt,
        endAt: new Date(data.endAt),
        allDay: data.allDay ?? false,
        type: data.type || "meeting",
        priority: data.priority || "P2",
        color: data.color,
        assigneeId: data.assigneeId,
        calendarId: data.calendarId,
        householdId,
        reminders:
          data.remindMinutesBefore != null
            ? {
                create: {
                  title: data.title,
                  remindAt: new Date(
                    startAt.getTime() - data.remindMinutesBefore * 60_000
                  ),
                },
              }
            : undefined,
      },
      include: { reminders: true },
    });
    return NextResponse.json(event);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
