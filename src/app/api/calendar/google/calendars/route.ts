import { NextResponse } from "next/server";
import {
  listGoogleCalendars,
  requireGoogleCalendarAccess,
  upsertGoogleCalendarsForHousehold,
} from "@/lib/google-calendar";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

/** Fetch Google calendar list and upsert into Flowdesk calendars. */
export async function POST() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const access = await requireGoogleCalendarAccess(user.id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, hint: access.hint, scope: access.scope },
      { status: access.status }
    );
  }

  const listed = await listGoogleCalendars(access.accessToken);
  if (!listed.ok) {
    return NextResponse.json(
      {
        error: "Failed to list Google calendars",
        detail: listed.detail,
        hint: "Enable Google Calendar API in Google Cloud Console, then unlink/link Google again.",
      },
      { status: 502 }
    );
  }

  const { calendars, disabledStale } = await upsertGoogleCalendarsForHousehold(
    householdId,
    listed.items
  );

  const all = await prisma.calendar.findMany({
    where: { householdId, externalSource: "google" },
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return NextResponse.json({
    ok: true,
    imported: calendars.length,
    disabledStale,
    calendars: all,
  });
}
