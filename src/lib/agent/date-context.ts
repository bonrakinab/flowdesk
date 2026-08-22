import * as chrono from "chrono-node";

/** Human + machine clock for the user's timezone. */
export function buildClockContext(now: Date, timeZone: string) {
  const tz = timeZone || "UTC";
  const safeTz = isValidTimeZone(tz) ? tz : "UTC";

  const full = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const isoLocal = formatLocalIso(now, safeTz);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    weekday: "long",
  }).format(now);

  return {
    timeZone: safeTz,
    localNowDisplay: full,
    localIsoDateTime: isoLocal,
    weekday,
  };
}

export type DateHint = {
  phrase: string;
  startIso: string;
  endIso: string | null;
};

/** Extract natural-language dates from the user message with chrono-node. */
export function extractDateHints(
  text: string,
  now: Date,
  timeZone: string
): DateHint[] {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  // chrono uses the JS Date "now" as reference; we keep wall-clock alignment
  // via the prompt's local clock context.
  const results = chrono.parse(text, now, { forwardDate: true });
  return results.slice(0, 8).map((r) => {
    const start = r.start.date();
    const end = r.end?.date() ?? null;
    return {
      phrase: r.text,
      startIso: toZonedIsoHint(start, tz),
      endIso: end ? toZonedIsoHint(end, tz) : null,
    };
  });
}

function isValidTimeZone(tz: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatLocalIso(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Prefer an ISO string that preserves the intended local wall time. */
function toZonedIsoHint(date: Date, timeZone: string) {
  // Emit local wall-clock ISO without Z so Gemini proposes times the UI can edit;
  // execute path accepts any Date-parseable string.
  return formatLocalIso(date, timeZone);
}
