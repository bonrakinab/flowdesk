import { addMonths, addWeeks, addDays } from "date-fns";

/** JS getDay(): 0=Sun … 6=Sat */
export type JsWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SeriesRecurrence = {
  freq: "weekly";
  byWeekday: JsWeekday[];
  timeHour: number;
  timeMinute: number;
};

export type SeriesInstance = {
  startAt: string;
  endAt: string;
};

export const MAX_SERIES_INSTANCES = 200;

export function expandWeeklySeries(opts: {
  byWeekday: JsWeekday[];
  hour: number;
  minute: number;
  durationMinutes?: number;
  from?: Date;
  until: Date;
}): SeriesInstance[] {
  const durationMs = (opts.durationMinutes ?? 60) * 60_000;
  const from = opts.from ? new Date(opts.from) : new Date();
  const until = new Date(opts.until);
  const days = [...new Set(opts.byWeekday)].sort((a, b) => a - b);
  if (!days.length) return [];

  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  const endDay = new Date(until);
  endDay.setHours(23, 59, 59, 999);

  const instances: SeriesInstance[] = [];
  while (cursor.getTime() <= endDay.getTime() && instances.length < MAX_SERIES_INSTANCES) {
    if (days.includes(cursor.getDay() as JsWeekday)) {
      const startAt = new Date(cursor);
      startAt.setHours(opts.hour, opts.minute, 0, 0);
      if (startAt.getTime() >= from.getTime() && startAt.getTime() <= until.getTime()) {
        instances.push({
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + durationMs).toISOString(),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return instances;
}

export function weekdayShortLabels(days: JsWeekday[]): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((d) => labels[d]).join(", ");
}

export function addDurationFromNow(
  amount: number,
  unit: "day" | "days" | "week" | "weeks" | "month" | "months",
  from = new Date()
): Date {
  const n = Math.max(1, amount);
  if (unit.startsWith("day")) return addDays(from, n);
  if (unit.startsWith("week")) return addWeeks(from, n);
  return addMonths(from, n);
}
