import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { parseIcs } from "@/lib/calendar-ics";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean().optional(),
  type: z.string().optional(),
  color: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  externalSource: z.string().optional().nullable(),
});

const jsonSchema = z.object({
  type: z.string().optional(),
  calendars: z
    .array(
      z.object({
        name: z.string().min(1),
        color: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        events: z.array(eventSchema).default([]),
      })
    )
    .default([]),
  unassignedEvents: z.array(eventSchema).optional(),
  events: z.array(eventSchema).optional(),
});

/**
 * Import calendars + events from JSON or ICS.
 * Body: { format?: "json"|"ics", text: string, calendarName?: string }
 */
export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const body = (await req.json()) as {
    format?: string;
    text?: string;
    calendarName?: string;
  };

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Missing import text" }, { status: 400 });
  }

  const format =
    body.format ||
    (body.text.includes("BEGIN:VCALENDAR")
      ? "ics"
      : body.text.trim().startsWith("{")
        ? "json"
        : "ics");

  let calendarsCreated = 0;
  let eventsCreated = 0;

  if (format === "ics") {
    const parsed = parseIcs(body.text);
    if (parsed.events.length === 0) {
      return NextResponse.json(
        {
          error: "No events found in that ICS file.",
          hint: "Confirm the file contains VEVENT blocks. Recurring series are expanded on import.",
          skipped: parsed.skipped,
        },
        { status: 400 }
      );
    }
    const cal = await prisma.calendar.create({
      data: {
        name:
          body.calendarName ||
          parsed.calendarName ||
          `Imported ${new Date().toISOString().slice(0, 10)}`,
        color: "#0d9488",
        externalSource: "imported",
        syncEnabled: false,
        householdId,
      },
    });
    calendarsCreated = 1;
    // Cap huge expansions (e.g. daily forever) so import stays responsive.
    const toInsert = parsed.events.slice(0, 5000);
    for (const e of toInsert) {
      await prisma.calendarEvent.create({
        data: {
          title: e.title,
          description: e.description,
          startAt: e.startAt,
          endAt: e.endAt,
          allDay: e.allDay,
          type: "meeting",
          color: "#0d9488",
          householdId,
          calendarId: cal.id,
          externalId: e.uid || null,
          externalSource: "imported",
        },
      });
      eventsCreated++;
    }
    return NextResponse.json({
      ok: true,
      format: "ics",
      calendarsCreated,
      eventsCreated,
      skipped: parsed.skipped,
      truncated: parsed.events.length > toInsert.length,
      calendarId: cal.id,
      calendarName: cal.name,
    });
  }

  let parsedJson: z.infer<typeof jsonSchema>;
  try {
    parsedJson = jsonSchema.parse(JSON.parse(body.text));
  } catch (e) {
    return NextResponse.json(
      {
        error: "Invalid calendar JSON",
        detail: e instanceof Error ? e.message : "parse failed",
      },
      { status: 400 }
    );
  }

  const flatEvents = [
    ...(parsedJson.events || []),
    ...(parsedJson.unassignedEvents || []),
  ];

  if (parsedJson.calendars.length === 0 && flatEvents.length > 0) {
    const cal = await prisma.calendar.create({
      data: {
        name:
          body.calendarName ||
          `Imported ${new Date().toISOString().slice(0, 10)}`,
        externalSource: "imported",
        syncEnabled: false,
        householdId,
      },
    });
    calendarsCreated = 1;
    for (const e of flatEvents) {
      await prisma.calendarEvent.create({
        data: {
          title: e.title,
          description: e.description,
          startAt: new Date(e.startAt),
          endAt: new Date(e.endAt),
          allDay: e.allDay ?? false,
          type: e.type || "meeting",
          color: e.color,
          householdId,
          calendarId: cal.id,
          externalId: e.externalId,
          externalSource: e.externalSource || "imported",
        },
      });
      eventsCreated++;
    }
  } else {
    for (const c of parsedJson.calendars) {
      const cal = await prisma.calendar.create({
        data: {
          name: c.name,
          color: c.color,
          description: c.description,
          externalSource: "imported",
          syncEnabled: false,
          householdId,
        },
      });
      calendarsCreated++;
      for (const e of c.events) {
        await prisma.calendarEvent.create({
          data: {
            title: e.title,
            description: e.description,
            startAt: new Date(e.startAt),
            endAt: new Date(e.endAt),
            allDay: e.allDay ?? false,
            type: e.type || "meeting",
            color: e.color || c.color,
            householdId,
            calendarId: cal.id,
            externalId: e.externalId,
            externalSource: e.externalSource || "imported",
          },
        });
        eventsCreated++;
      }
    }
    if (flatEvents.length > 0) {
      const cal = await prisma.calendar.create({
        data: {
          name: "Imported (unassigned)",
          externalSource: "imported",
          syncEnabled: false,
          householdId,
        },
      });
      calendarsCreated++;
      for (const e of flatEvents) {
        await prisma.calendarEvent.create({
          data: {
            title: e.title,
            description: e.description,
            startAt: new Date(e.startAt),
            endAt: new Date(e.endAt),
            allDay: e.allDay ?? false,
            type: e.type || "meeting",
            color: e.color,
            householdId,
            calendarId: cal.id,
            externalId: e.externalId,
            externalSource: e.externalSource || "imported",
          },
        });
        eventsCreated++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    format: "json",
    calendarsCreated,
    eventsCreated,
  });
}
