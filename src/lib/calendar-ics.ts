/** ICS (iCalendar) helpers for Flowdesk calendar import/export. */

import { RRule } from "rrule";

export type IcsEvent = {
  uid?: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatUtc(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function formatDateOnly(d: Date) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function unfold(ics: string) {
  return ics
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");
}

function unescapeText(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** All-day dates use noon UTC so they stay on the same civil day in US/EU timezones. */
export function allDayUtc(y: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(y, monthIndex, day, 12, 0, 0));
}

function parseIcsDate(
  raw: string,
  params: string
): { date: Date; allDay: boolean } {
  const cleaned = raw.trim();
  const isDate =
    /VALUE=DATE/i.test(params) || /^\d{8}$/.test(cleaned);

  if (isDate) {
    const y = Number(cleaned.slice(0, 4));
    const m = Number(cleaned.slice(4, 6)) - 1;
    const d = Number(cleaned.slice(6, 8));
    return { date: allDayUtc(y, m, d), allDay: true };
  }

  // 20240101T120000Z | 20240101T120000 | with optional fractional seconds
  const m = cleaned.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?(Z)?$/i
  );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6]);
    const zulu = Boolean(m[7]);
    // TZID / floating: keep wall-clock as UTC components so the stamped time
    // is visible; perfect zone conversion needs a TZ DB.
    const date = zulu
      ? new Date(Date.UTC(y, mo, d, hh, mm, ss))
      : new Date(Date.UTC(y, mo, d, hh, mm, ss));
    return { date, allDay: false };
  }

  const fallback = new Date(cleaned);
  return {
    date: Number.isNaN(fallback.getTime()) ? new Date() : fallback,
    allDay: false,
  };
}

function getProp(body: string, key: string) {
  const re = new RegExp(`^${key}([^:\\n]*):(.*)$`, "im");
  const m = body.match(re);
  return m ? { params: m[1] || "", value: m[2].trim() } : null;
}

function expandRrule(opts: {
  rruleLine: string;
  start: Date;
  durationMs: number;
  allDay: boolean;
  uid?: string;
  title: string;
  description?: string | null;
}): IcsEvent[] {
  try {
    const rule = RRule.fromString(
      `DTSTART:${formatUtc(opts.start)}\nRRULE:${opts.rruleLine}`
    );
    // Expand ~1 year back through 2 years forward from now.
    const windowStart = new Date();
    windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1);
    const windowEnd = new Date();
    windowEnd.setUTCFullYear(windowEnd.getUTCFullYear() + 2);
    const dates = rule.between(windowStart, windowEnd, true);
    if (dates.length === 0) {
      // Fall back to the series seed so something is imported.
      return [
        {
          uid: opts.uid,
          title: opts.title,
          description: opts.description,
          startAt: opts.start,
          endAt: new Date(opts.start.getTime() + opts.durationMs),
          allDay: opts.allDay,
        },
      ];
    }
    return dates.map((startAt, i) => ({
      uid: opts.uid ? `${opts.uid}-${i}` : undefined,
      title: opts.title,
      description: opts.description,
      startAt,
      endAt: new Date(startAt.getTime() + opts.durationMs),
      allDay: opts.allDay,
    }));
  } catch {
    return [
      {
        uid: opts.uid,
        title: opts.title,
        description: opts.description,
        startAt: opts.start,
        endAt: new Date(opts.start.getTime() + opts.durationMs),
        allDay: opts.allDay,
      },
    ];
  }
}

export function eventsToIcs(
  events: IcsEvent[],
  calendarName = "Flowdesk"
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flowdesk//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const e of events) {
    const uid =
      e.uid ||
      `${e.startAt.getTime()}-${Math.random().toString(36).slice(2)}@flowdesk`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    if (e.allDay) {
      const start = allDayUtc(
        e.startAt.getUTCFullYear(),
        e.startAt.getUTCMonth(),
        e.startAt.getUTCDate()
      );
      let end = new Date(e.endAt);
      if (end.getTime() <= start.getTime()) {
        end = allDayUtc(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + 1
        );
      } else {
        end = allDayUtc(
          end.getUTCFullYear(),
          end.getUTCMonth(),
          end.getUTCDate()
        );
      }
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(end)}`);
    } else {
      lines.push(`DTSTART:${formatUtc(e.startAt)}`);
      lines.push(`DTEND:${formatUtc(e.endAt)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) {
      lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    }
    lines.push(`DTSTAMP:${formatUtc(new Date())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function parseIcs(ics: string): {
  calendarName?: string;
  events: IcsEvent[];
  skipped: number;
} {
  const text = unfold(ics);
  const blocks = text.split("BEGIN:VEVENT");
  const header = blocks[0] || "";
  const nameMatch = header.match(/X-WR-CALNAME:([^\n]*)/);
  const calendarName = nameMatch
    ? unescapeText(nameMatch[1].trim())
    : undefined;

  const events: IcsEvent[] = [];
  let skipped = 0;

  for (const block of blocks.slice(1)) {
    const body = block.split("END:VEVENT")[0] || "";
    const status = getProp(body, "STATUS")?.value?.toUpperCase();
    if (status === "CANCELLED") {
      skipped++;
      continue;
    }

    const summary = getProp(body, "SUMMARY");
    const description = getProp(body, "DESCRIPTION");
    const uid = getProp(body, "UID");
    const dtStart = getProp(body, "DTSTART");
    const dtEnd = getProp(body, "DTEND");
    const rrule = getProp(body, "RRULE");

    if (!dtStart) {
      skipped++;
      continue;
    }

    const start = parseIcsDate(dtStart.value, dtStart.params);
    let end: { date: Date; allDay: boolean };
    if (dtEnd) {
      end = parseIcsDate(dtEnd.value, dtEnd.params);
    } else {
      const durationMs = start.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
      end = {
        date: new Date(start.date.getTime() + durationMs),
        allDay: start.allDay,
      };
    }

    // All-day DTEND is exclusive in ICS — keep a positive duration for queries.
    if (start.allDay && end.date.getTime() <= start.date.getTime()) {
      end = {
        date: new Date(start.date.getTime() + 24 * 60 * 60 * 1000),
        allDay: true,
      };
    }

    const title = summary?.value
      ? unescapeText(summary.value)
      : "(No title)";
    const desc = description ? unescapeText(description.value) : null;
    const durationMs = Math.max(
      60_000,
      end.date.getTime() - start.date.getTime()
    );

    if (rrule?.value) {
      const expanded = expandRrule({
        rruleLine: rrule.value,
        start: start.date,
        durationMs,
        allDay: start.allDay,
        uid: uid?.value,
        title,
        description: desc,
      });
      events.push(...expanded);
    } else {
      events.push({
        uid: uid?.value,
        title,
        description: desc,
        startAt: start.date,
        endAt: end.date,
        allDay: start.allDay,
      });
    }
  }

  return { calendarName, events, skipped };
}
