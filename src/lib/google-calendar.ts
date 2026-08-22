import { prisma } from "@/lib/db";
import {
  getFreshGoogleAccessToken,
  hasCalendarScope,
} from "@/lib/google";

type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
};

type GooglePerson = {
  email?: string;
  displayName?: string;
  self?: boolean;
};

type GoogleEventItem = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  visibility?: string;
  organizer?: GooglePerson;
  creator?: GooglePerson;
  attendees?: GooglePerson[];
  htmlLink?: string;
};

async function googleAccountForUser(userId: string) {
  return prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
}

export async function requireGoogleCalendarAccess(userId: string) {
  const account = await googleAccountForUser(userId);
  if (!account) {
    return {
      ok: false as const,
      status: 400,
      error: "Link Google on Account first.",
      hint: "Use Link Google account, approve calendar access, then try again.",
    };
  }
  const token = await getFreshGoogleAccessToken(account);
  if (!token.ok) {
    return {
      ok: false as const,
      status: 401,
      error: token.error,
      hint: token.hint,
    };
  }
  if (!hasCalendarScope(token.scope)) {
    return {
      ok: false as const,
      status: 403,
      error: "Google Calendar permission is missing.",
      hint: "Unlink Google, then Link Google again and accept calendar access.",
      scope: token.scope,
    };
  }
  return { ok: true as const, accessToken: token.accessToken, scope: token.scope };
}

export async function listGoogleCalendars(accessToken: string) {
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList"
  );
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("minAccessRole", "reader");
  // Include calendars hidden in Google UI (shared calendars others create on).
  url.searchParams.set("showHidden", "true");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      status: res.status,
      detail: text.slice(0, 400),
    };
  }
  const data = (await res.json()) as { items?: GoogleCalendarListItem[] };
  return { ok: true as const, items: data.items || [] };
}

function shouldAutoEnableSync(item: GoogleCalendarListItem) {
  if (item.primary) return true;
  if (item.selected) return true;
  // Shared calendars you can write to often hold events others create for you.
  if (item.accessRole === "owner" || item.accessRole === "writer") return true;
  return false;
}

export async function upsertGoogleCalendarsForHousehold(
  householdId: string,
  items: GoogleCalendarListItem[]
) {
  const calendars = [];
  const seenExternalIds = new Set<string>();

  for (const item of items) {
    if (!item.id) continue;
    seenExternalIds.add(item.id);
    const existing = await prisma.calendar.findFirst({
      where: {
        householdId,
        externalSource: "google",
        externalId: item.id,
      },
    });
    const name = item.summary || (item.primary ? "Primary" : item.id);
    const color = item.backgroundColor || null;
    if (existing) {
      calendars.push(
        await prisma.calendar.update({
          where: { id: existing.id },
          data: {
            name,
            color,
            description: item.description || null,
            // Don't force-disable; only turn on when newly appropriate.
            ...(shouldAutoEnableSync(item) && !existing.syncEnabled
              ? { syncEnabled: true }
              : {}),
          },
        })
      );
    } else {
      calendars.push(
        await prisma.calendar.create({
          data: {
            name,
            color,
            description: item.description || null,
            externalId: item.id,
            externalSource: "google",
            syncEnabled: shouldAutoEnableSync(item),
            householdId,
          },
        })
      );
    }
  }

  // Stale Google calendars (deleted Classroom / unsubscribed) 404 on sync —
  // turn them off so one broken calendar doesn't break the whole sync.
  const stale = await prisma.calendar.findMany({
    where: {
      householdId,
      externalSource: "google",
      externalId: { not: null },
      syncEnabled: true,
    },
  });
  let disabledStale = 0;
  for (const cal of stale) {
    if (!cal.externalId || seenExternalIds.has(cal.externalId)) continue;
    await prisma.calendar.update({
      where: { id: cal.id },
      data: { syncEnabled: false },
    });
    disabledStale++;
  }

  return { calendars, disabledStale };
}

async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
) {
  const events: GoogleEventItem[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    // Include invitations / events created by others on this calendar.
    url.searchParams.set("showDeleted", "false");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, detail: text.slice(0, 400), status: res.status };
    }
    const data = (await res.json()) as {
      items?: GoogleEventItem[];
      nextPageToken?: string;
    };
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { ok: true as const, events };
}

function personLabel(person?: GooglePerson) {
  if (!person) return null;
  return person.displayName || person.email || null;
}

function eventPeople(item: GoogleEventItem) {
  const organizerName = personLabel(item.organizer);
  const organizerEmail = item.organizer?.email || null;
  const createdByName = personLabel(item.creator);
  const organizerIsSelf = Boolean(item.organizer?.self);
  const creatorIsSelf = Boolean(item.creator?.self);

  let description = item.description || null;
  const credits: string[] = [];
  if (createdByName && !creatorIsSelf) {
    credits.push(`Created by ${createdByName}`);
  }
  if (
    organizerName &&
    !organizerIsSelf &&
    organizerName !== createdByName
  ) {
    credits.push(`Organized by ${organizerName}`);
  }
  if (credits.length) {
    const creditLine = credits.join(" · ");
    description = description
      ? `${description}\n\n${creditLine}`
      : creditLine;
  }

  const title =
    item.summary?.trim() ||
    (organizerName && !organizerIsSelf
      ? `Event by ${organizerName}`
      : createdByName && !creatorIsSelf
        ? `Event by ${createdByName}`
        : "Google event");

  return {
    title,
    description,
    organizerName: organizerIsSelf ? null : organizerName,
    organizerEmail: organizerIsSelf ? null : organizerEmail,
    createdByName: creatorIsSelf ? null : createdByName,
  };
}

export async function syncGoogleCalendarEvents(opts: {
  householdId: string;
  accessToken: string;
  calendar: {
    id: string;
    externalId: string | null;
    color: string | null;
    name: string;
  };
  daysAhead?: number;
  daysBehind?: number;
}) {
  if (!opts.calendar.externalId) {
    return { upserted: 0, skipped: true as const };
  }

  const behind = opts.daysBehind ?? 14;
  const ahead = opts.daysAhead ?? 120;
  const timeMin = new Date(
    Date.now() - behind * 24 * 60 * 60 * 1000
  ).toISOString();
  const timeMax = new Date(
    Date.now() + ahead * 24 * 60 * 60 * 1000
  ).toISOString();

  const fetched = await fetchGoogleEvents(
    opts.accessToken,
    opts.calendar.externalId,
    timeMin,
    timeMax
  );
  if (!fetched.ok) {
    const notFound =
      fetched.status === 404 ||
      /"reason":\s*"notFound"/i.test(fetched.detail || "") ||
      /Not Found/i.test(fetched.detail || "");
    return {
      upserted: 0,
      error: "Google Calendar API failed",
      detail: fetched.detail,
      status: fetched.status,
      notFound,
      calendarId: opts.calendar.id,
      calendarName: opts.calendar.name,
    };
  }

  let upserted = 0;
  let fromOthers = 0;
  for (const item of fetched.events) {
    if (!item.id || item.status === "cancelled") continue;
    const startRaw = item.start?.dateTime || item.start?.date;
    const endRaw = item.end?.dateTime || item.end?.date;
    if (!startRaw || !endRaw) continue;
    const allDay = Boolean(item.start?.date && !item.start?.dateTime);
    const startAt = new Date(startRaw);
    const endAt = new Date(endRaw);
    const people = eventPeople(item);
    if (people.organizerName || people.createdByName) fromOthers++;

    const existing = await prisma.calendarEvent.findFirst({
      where: {
        householdId: opts.householdId,
        externalSource: "google",
        externalId: item.id,
        OR: [{ calendarId: opts.calendar.id }, { calendarId: null }],
      },
    });

    const data = {
      title: people.title,
      description: people.description,
      startAt,
      endAt,
      allDay,
      color: opts.calendar.color,
      calendarId: opts.calendar.id,
      externalSource: "google" as const,
      externalId: item.id,
      organizerName: people.organizerName,
      organizerEmail: people.organizerEmail,
      createdByName: people.createdByName,
    };

    if (existing) {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.calendarEvent.create({
        data: {
          ...data,
          type: "meeting",
          householdId: opts.householdId,
        },
      });
    }
    upserted++;
  }

  return {
    upserted,
    fromOthers,
    calendarId: opts.calendar.id,
    calendarName: opts.calendar.name,
  };
}
