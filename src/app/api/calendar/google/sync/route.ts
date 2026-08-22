import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import {
  requireGoogleCalendarAccess,
  syncGoogleCalendarEvents,
  listGoogleCalendars,
  upsertGoogleCalendarsForHousehold,
} from "@/lib/google-calendar";
import {
  requireGoogleTasksAccess,
  syncGoogleTasks,
} from "@/lib/google-tasks";

/**
 * Sync Google calendar events + Google Tasks (todos) into Flowdesk.
 * Body optional: { calendarIds?: string[], refreshList?: boolean, tasks?: boolean }
 *
 * One broken/stale calendar (e.g. deleted Classroom) must not abort the whole sync.
 */
export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const body = (await req.json().catch(() => ({}))) as {
    calendarIds?: string[];
    refreshList?: boolean;
    tasks?: boolean;
  };
  const wantTasks = body.tasks !== false;

  const access = await requireGoogleCalendarAccess(user.id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, hint: access.hint, scope: access.scope },
      { status: access.status }
    );
  }

  let disabledStale = 0;
  if (body.refreshList !== false) {
    const listed = await listGoogleCalendars(access.accessToken);
    if (listed.ok) {
      const upserted = await upsertGoogleCalendarsForHousehold(
        householdId,
        listed.items
      );
      disabledStale = upserted.disabledStale;
    }
  }

  const calendars = await prisma.calendar.findMany({
    where: {
      householdId,
      externalSource: "google",
      externalId: { not: null },
      ...(body.calendarIds?.length
        ? { id: { in: body.calendarIds } }
        : { syncEnabled: true }),
    },
    orderBy: { name: "asc" },
  });

  const results: Awaited<ReturnType<typeof syncGoogleCalendarEvents>>[] = [];
  const failures: {
    calendarId: string;
    calendarName: string;
    error: string;
    detail?: string;
    notFound?: boolean;
  }[] = [];
  let upserted = 0;

  for (const cal of calendars) {
    const r = await syncGoogleCalendarEvents({
      householdId,
      accessToken: access.accessToken,
      calendar: cal,
    });
    results.push(r);
    upserted += r.upserted || 0;

    if ("error" in r && r.error) {
      failures.push({
        calendarId: r.calendarId || cal.id,
        calendarName: r.calendarName || cal.name,
        error: r.error,
        detail: "detail" in r ? r.detail : undefined,
        notFound: "notFound" in r ? Boolean(r.notFound) : false,
      });

      // Auto-disable calendars Google no longer serves (404 / notFound)
      if ("notFound" in r && r.notFound) {
        await prisma.calendar.update({
          where: { id: cal.id },
          data: { syncEnabled: false },
        });
        disabledStale += 1;
      }
    }
  }

  let tasks: Awaited<ReturnType<typeof syncGoogleTasks>> | {
    skipped: true;
    reason: string;
    hint?: string;
  } | null = null;

  if (wantTasks) {
    const tasksAccess = await requireGoogleTasksAccess(user.id);
    if (!tasksAccess.ok) {
      tasks = {
        skipped: true,
        reason: tasksAccess.error,
        hint: tasksAccess.hint,
      };
    } else {
      const synced = await syncGoogleTasks({
        householdId,
        userId: user.id,
        accessToken: tasksAccess.accessToken,
      });
      if (!synced.ok) {
        tasks = {
          skipped: true,
          reason: synced.error,
          hint: "Enable Google Tasks API in Cloud Console, or unlink/link Google again.",
        };
      } else {
        tasks = synced;
      }
    }
  }

  const ok = failures.length === 0 || upserted > 0 || Boolean(tasks && "ok" in tasks && tasks.ok);

  return NextResponse.json({
    ok,
    calendars: calendars.length,
    upserted,
    disabledStale,
    failures,
    fromOthers: results.reduce(
      (n, r) => n + ("fromOthers" in r && r.fromOthers ? r.fromOthers : 0),
      0
    ),
    results,
    tasks,
    ...(failures.length
      ? {
          warning: `${failures.length} calendar(s) failed (often deleted Classroom calendars). Others synced.`,
          hint: "Failed calendars were turned off when Google returned Not Found. Re-enable on Account if needed.",
        }
      : {}),
  });
}
