import { format, startOfDay, addDays, eachDayOfInterval } from "date-fns";

/**
 * Wall-clock HH:mm on the calendar date of `day` (uses day.getFullYear/Month/Date).
 * @param tzOffsetMinutes from `Date#getTimezoneOffset()` — minutes to add to local to get UTC.
 *   Omit to use the runtime local timezone.
 */
export function doseAtOnDay(
  day: Date,
  hhmm: string,
  tzOffsetMinutes?: number
): Date {
  const [hRaw, mRaw] = hhmm.split(":").map((x) => parseInt(x, 10));
  const hour = Number.isFinite(hRaw) ? hRaw : 0;
  const minute = Number.isFinite(mRaw) ? mRaw : 0;
  const y = day.getFullYear();
  const mo = day.getMonth();
  const d = day.getDate();

  if (tzOffsetMinutes == null || !Number.isFinite(tzOffsetMinutes)) {
    const out = new Date(y, mo, d, hour, minute, 0, 0);
    return out;
  }

  // Treat y-m-d h:m as wall time in the user's zone → absolute UTC instant.
  return new Date(Date.UTC(y, mo, d, hour, minute, 0, 0) + tzOffsetMinutes * 60_000);
}

/** A Date whose local Y/M/D equals "today" in the given offset. */
export function wallDayFor(
  instant: Date,
  tzOffsetMinutes?: number
): Date {
  if (tzOffsetMinutes == null || !Number.isFinite(tzOffsetMinutes)) {
    return startOfDay(instant);
  }
  const local = new Date(instant.getTime() - tzOffsetMinutes * 60_000);
  return new Date(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    12,
    0,
    0,
    0
  );
}

export function parseTimesJson(timesJson: string): string[] {
  try {
    const arr = JSON.parse(timesJson || "[]") as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t): t is string => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t))
      .map((t) => {
        const [h, m] = t.split(":");
        return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
      });
  } catch {
    return [];
  }
}

export type DueMedDose = {
  medicationId: string;
  name: string;
  dosage: string | null;
  color: string;
  scheduledFor: Date;
  time: string;
  logId: string | null;
  takenAt: Date | null;
  skipped: boolean;
  remindMinutesBefore: number;
};

type MedInput = {
  id: string;
  name: string;
  dosage: string | null;
  color: string;
  timesJson: string;
  remindMinutesBefore?: number | null;
  doseLogs: {
    id: string;
    scheduledFor: Date;
    takenAt: Date | null;
    skipped: boolean;
  }[];
};

function matchLog(logs: MedInput["doseLogs"], scheduledFor: Date) {
  return logs.find(
    (l) => Math.abs(l.scheduledFor.getTime() - scheduledFor.getTime()) < 60_000
  );
}

/** Build doses for one calendar day (pass a wall-day Date). */
export function buildTodayDoses(
  meds: MedInput[],
  day: Date = new Date(),
  tzOffsetMinutes?: number
): DueMedDose[] {
  const out: DueMedDose[] = [];
  for (const med of meds) {
    const times = parseTimesJson(med.timesJson);
    const lead = med.remindMinutesBefore ?? 15;
    for (const time of times) {
      const scheduledFor = doseAtOnDay(day, time, tzOffsetMinutes);
      const log = matchLog(med.doseLogs, scheduledFor);
      out.push({
        medicationId: med.id,
        name: med.name,
        dosage: med.dosage,
        color: med.color,
        scheduledFor,
        time,
        logId: log?.id ?? null,
        takenAt: log?.takenAt ?? null,
        skipped: log?.skipped ?? false,
        remindMinutesBefore: lead,
      });
    }
  }
  return out.sort(
    (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()
  );
}

/** Expand doses for every wall day overlapping [from, to]. */
export function buildDosesInRange(
  meds: MedInput[],
  from: Date,
  to: Date,
  tzOffsetMinutes?: number
): DueMedDose[] {
  const start = wallDayFor(from, tzOffsetMinutes);
  const end = wallDayFor(to, tzOffsetMinutes);
  const days = eachDayOfInterval({ start, end });
  const out: DueMedDose[] = [];
  for (const day of days) {
    out.push(...buildTodayDoses(meds, day, tzOffsetMinutes));
  }
  const seen = new Set<string>();
  return out
    .filter((d) => {
      const key = `${d.medicationId}:${d.scheduledFor.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

/**
 * Doses whose alert time (dose − lead, or dose) falls in [fromMs, toMs].
 * Returns doses once even if both lead and dose fall in the window.
 */
export function dosesInWindow(
  doses: DueMedDose[],
  fromMs: number,
  toMs: number
) {
  return doses.filter((d) => {
    if (d.takenAt || d.skipped) return false;
    const doseMs = d.scheduledFor.getTime();
    const leadMs = doseMs - (d.remindMinutesBefore || 0) * 60_000;
    const alertMs = d.remindMinutesBefore > 0 ? leadMs : doseMs;
    // Fire if either the lead reminder or the exact dose time is in-window
    const leadDue = leadMs >= fromMs && leadMs <= toMs;
    const doseDue = doseMs >= fromMs && doseMs <= toMs;
    return leadDue || doseDue || (alertMs >= fromMs && alertMs <= toMs);
  });
}

export function medAlertAt(dose: DueMedDose, nowMs = Date.now()): {
  at: Date;
  phase: "lead" | "due";
} {
  const doseMs = dose.scheduledFor.getTime();
  const lead = dose.remindMinutesBefore || 0;
  const leadMs = doseMs - lead * 60_000;
  // Prefer lead phase until we're past it (within a minute of dose → due)
  if (lead > 0 && nowMs < doseMs - 30_000) {
    return { at: new Date(leadMs), phase: "lead" };
  }
  return { at: new Date(doseMs), phase: "due" };
}

export function tomorrowLabel() {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}
