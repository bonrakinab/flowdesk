import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { eventsToIcs } from "@/lib/calendar-ics";

/**
 * Export calendars + events.
 * Query: format=json|ics, calendarId?=..., from?=ISO, to?=ISO
 */
export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "json").toLowerCase();
  const calendarId = searchParams.get("calendarId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const calendars = await prisma.calendar.findMany({
    where: {
      householdId,
      ...(calendarId ? { id: calendarId } : {}),
    },
    orderBy: { name: "asc" },
  });

  const events = await prisma.calendarEvent.findMany({
    where: {
      householdId,
      ...(calendarId ? { calendarId } : {}),
      ...(from && to
        ? {
            startAt: { lte: new Date(to) },
            endAt: { gte: new Date(from) },
          }
        : {}),
    },
    orderBy: { startAt: "asc" },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "ics") {
    const ics = eventsToIcs(
      events.map((e) => ({
        uid: e.externalId
          ? `${e.externalId}@flowdesk`
          : `${e.id}@flowdesk.local`,
        title: e.title,
        description: e.description,
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
      })),
      calendars[0]?.name || "Flowdesk"
    );
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="flowdesk-calendar-${stamp}.ics"`,
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    type: "flowdesk-calendar",
    calendars: calendars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      description: c.description,
      externalId: c.externalId,
      externalSource: c.externalSource,
      syncEnabled: c.syncEnabled,
      events: events
        .filter((e) => e.calendarId === c.id)
        .map((e) => ({
          title: e.title,
          description: e.description,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt.toISOString(),
          allDay: e.allDay,
          type: e.type,
          color: e.color,
          externalId: e.externalId,
          externalSource: e.externalSource,
        })),
    })),
    unassignedEvents: events
      .filter((e) => !e.calendarId)
      .map((e) => ({
        title: e.title,
        description: e.description,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        allDay: e.allDay,
        type: e.type,
        color: e.color,
        externalId: e.externalId,
        externalSource: e.externalSource,
      })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="flowdesk-calendar-${stamp}.json"`,
    },
  });
}
