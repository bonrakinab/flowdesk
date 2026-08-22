import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { MAX_SERIES_INSTANCES } from "@/lib/event-series";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.string().optional(),
  color: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  calendarId: z.string().optional().nullable(),
  remindMinutesBefore: z.number().int().min(0).max(7 * 24 * 60).optional().nullable(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  instances: z
    .array(
      z.object({
        startAt: z.string(),
        endAt: z.string(),
      })
    )
    .min(1)
    .max(MAX_SERIES_INSTANCES),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  try {
    const data = schema.parse(await req.json());
    const remindMinutes = data.remindMinutesBefore ?? null;

    const created = await prisma.$transaction(async (tx) => {
      const events = [];
      for (const inst of data.instances) {
        const startAt = new Date(inst.startAt);
        const endAt = new Date(inst.endAt);
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
          throw new Error("Invalid instance datetime");
        }
        const event = await tx.calendarEvent.create({
          data: {
            title: data.title,
            description: data.description,
            startAt,
            endAt,
            allDay: false,
            type: data.type || "personal",
            priority: data.priority || "P2",
            color: data.color,
            assigneeId: data.assigneeId,
            calendarId: data.calendarId,
            householdId,
            reminders:
              remindMinutes != null
                ? {
                    create: {
                      title: data.title,
                      remindAt: new Date(startAt.getTime() - remindMinutes * 60_000),
                    },
                  }
                : undefined,
          },
        });
        events.push(event);
      }
      return events;
    });

    return NextResponse.json({
      created: created.length,
      firstStartAt: created[0]?.startAt ?? null,
      lastStartAt: created[created.length - 1]?.startAt ?? null,
      ids: created.map((e) => e.id),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    if (e instanceof Error && e.message === "Invalid instance datetime") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Series create failed" }, { status: 500 });
  }
}
