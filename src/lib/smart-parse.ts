import * as chrono from "chrono-node";
import {
  addDurationFromNow,
  type JsWeekday,
  type SeriesRecurrence,
} from "@/lib/event-series";

export type ParseContext = {
  projects: { id: string; name: string; color?: string }[];
  members: { id: string; name: string | null; email: string; color?: string }[];
  contacts?: { id: string; name: string }[];
  medications?: {
    id: string;
    name: string;
    dosage?: string | null;
    times?: string[];
    remindMinutesBefore?: number;
  }[];
};

export type SmartParseIntent = "ticket" | "event" | "event_series" | "medication";

export type SmartParseResult = {
  title: string;
  cleanedText: string;
  intent: SmartParseIntent;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  status: string | null;
  priority: string | null;
  energy: string | null;
  estimateMin: number | null;
  projectId: string | null;
  projectName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  contactId: string | null;
  contactName: string | null;
  waitingOn: string | null;
  isFocus: boolean;
  eventType: string | null;
  recurrence: SeriesRecurrence | null;
  untilAt: string | null;
  remindMinutesBefore: number | null;
  durationMinutes: number;
  medicationId: string | null;
  dosage: string | null;
  medTimes: string[] | null;
  confidence: number;
  hints: string[];
};

const STATUS_PATTERNS: { re: RegExp; status: string }[] = [
  { re: /\b(backlog)\b/i, status: "Backlog" },
  { re: /\b(ready|triage|to[- ]?do)\b/i, status: "Ready" },
  { re: /\b(doing|in[- ]?progress|working on|wip)\b/i, status: "Doing" },
  { re: /\b(waiting|blocked|pending|awaiting)\b/i, status: "Waiting" },
  { re: /\b(done|finished|complete[d]?)\b/i, status: "Done" },
];

const PRIORITY_PATTERNS: { re: RegExp; priority: string }[] = [
  { re: /\b(p0|critical|asap|urgent|emergency)\b/i, priority: "P0" },
  { re: /\b(p1|high priority|important)\b/i, priority: "P1" },
  { re: /\b(p2|medium priority|normal)\b/i, priority: "P2" },
  { re: /\b(p3|low priority|someday|whenever)\b/i, priority: "P3" },
];

const ENERGY_PATTERNS: { re: RegExp; energy: string }[] = [
  { re: /\b(low energy|easy|light)\b/i, energy: "low" },
  { re: /\b(medium energy)\b/i, energy: "medium" },
  { re: /\b(high energy|deep work|focus[- ]?heavy)\b/i, energy: "high" },
];

const EVENT_TYPE_PATTERNS: { re: RegExp; type: string }[] = [
  { re: /\b(meeting|call|sync|standup)\b/i, type: "meeting" },
  { re: /\b(family|kids?|school)\b/i, type: "family" },
  { re: /\b(class|course|lecture|lesson)\b/i, type: "class" },
  { re: /\b(deadline|due)\b/i, type: "deadline" },
];

const WEEKDAY_MAP: Record<string, JsWeekday> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const WEEKDAY_TOKEN =
  "sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat";

function stripRange(text: string, start: number, end: number) {
  return (text.slice(0, start) + " " + text.slice(end)).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchEntity<T extends { id: string; name: string | null }>(
  text: string,
  items: T[],
  getName: (item: T) => string
): { item: T; index: number; length: number } | null {
  const lower = text.toLowerCase();
  const ranked = items
    .map((item) => {
      const name = getName(item).trim();
      if (!name) return null;
      const idx = lower.indexOf(name.toLowerCase());
      if (idx === -1) return null;
      return { item, index: idx, length: name.length, score: name.length };
    })
    .filter(Boolean) as {
    item: T;
    index: number;
    length: number;
    score: number;
  }[];

  if (!ranked.length) return null;
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0];
}

function extractEstimate(text: string): { minutes: number; start: number; end: number } | null {
  const patterns = [
    /\b(\d+)\s*(?:min|mins|minutes)\b/i,
    /\b(\d+)\s*(?:h|hr|hrs|hours)\b/i,
    /\bquick(?:\s+win)?\b/i,
    /\b(\d+)\s*m\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    if (/quick/i.test(m[0])) {
      return { minutes: 15, start: m.index, end: m.index + m[0].length };
    }
    const n = Number(m[1]);
    const minutes = /h/i.test(m[0]) ? n * 60 : n;
    return { minutes, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

function extractWaitingOn(text: string): { value: string; start: number; end: number } | null {
  const m =
    /\b(?:waiting(?:\s+on)?|blocked(?:\s+by)?|awaiting)\s+([A-Za-z][\w.-]{0,30})/i.exec(
      text
    );
  if (!m) return null;
  return {
    value: m[1].trim(),
    start: m.index,
    end: m.index + m[0].length,
  };
}

function parseClockTime(raw: string): { hour: number; minute: number } | null {
  const t = raw.trim().toLowerCase();
  if (t === "noon") return { hour: 12, minute: 0 };
  if (t === "midnight") return { hour: 0, minute: 0 };
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(t);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function parseWeekdayList(chunk: string): JsWeekday[] {
  const days: JsWeekday[] = [];
  const re = new RegExp(`\\b(${WEEKDAY_TOKEN})\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) {
    const day = WEEKDAY_MAP[m[1].toLowerCase()];
    if (day != null && !days.includes(day)) days.push(day);
  }
  return days;
}

function extractRecurrence(text: string): {
  recurrence: SeriesRecurrence;
  start: number;
  end: number;
} | null {
  const re = new RegExp(
    `\\bevery(?:\\s+week(?:ly)?)?(?:\\s+on)?\\s+((?:(?:${WEEKDAY_TOKEN})(?:\\s*,\\s*|\\s+and\\s+|\\s*&\\s+|\\s+)+)*(?:${WEEKDAY_TOKEN}))(?:\\s+at\\s+(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?|noon|midnight))?`,
    "i"
  );
  const m = re.exec(text);
  if (!m) return null;
  const byWeekday = parseWeekdayList(m[1]);
  if (!byWeekday.length) return null;
  const clock = m[2] ? parseClockTime(m[2]) : { hour: 9, minute: 0 };
  if (!clock) return null;
  return {
    recurrence: {
      freq: "weekly",
      byWeekday,
      timeHour: clock.hour,
      timeMinute: clock.minute,
    },
    start: m.index,
    end: m.index + m[0].length,
  };
}

function extractUntil(text: string): {
  untilAt: Date;
  start: number;
  end: number;
  label: string;
} | null {
  const patterns = [
    /\b(?:set\s+(?:the\s+)?(?:event|events|schedule)\s+for\s+)?(?:the\s+)?next\s+(\d+)\s+(days?|weeks?|months?)\b/i,
    /\b(?:for|over|through|until)\s+(?:the\s+)?next\s+(\d+)\s+(days?|weeks?|months?)\b/i,
    /\bfor\s+(\d+)\s+(days?|weeks?|months?)\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const amount = Number(m[1]);
    const unit = m[2].toLowerCase() as "day" | "days" | "week" | "weeks" | "month" | "months";
    if (!Number.isFinite(amount) || amount < 1) continue;
    const untilAt = addDurationFromNow(amount, unit);
    return {
      untilAt,
      start: m.index,
      end: m.index + m[0].length,
      label: `next ${amount} ${unit}`,
    };
  }
  return null;
}

function extractReminders(text: string): {
  minutes: number;
  start: number;
  end: number;
} | null {
  const offset =
    /\b(?:remind(?:er|ers|me)?\s+)?(\d+)\s*(min|mins|minutes|h|hr|hrs|hours)\s+before\b/i.exec(
      text
    ) ||
    /\bremind(?:er|ers|me)?\s+(\d+)\s*(min|mins|minutes|h|hr|hrs|hours)?\b/i.exec(text);
  if (offset) {
    const n = Number(offset[1]);
    const unit = (offset[2] || "min").toLowerCase();
    const minutes = unit.startsWith("h") ? n * 60 : n;
    return {
      minutes,
      start: offset.index,
      end: offset.index + offset[0].length,
    };
  }

  const generic =
    /\b(?:set\s+)?reminders?\s+too\b/i.exec(text) ||
    /\b(?:with|and)\s+reminders?\b/i.exec(text) ||
    /\bset\s+reminders?\b/i.exec(text);
  if (generic) {
    return {
      minutes: 30,
      start: generic.index,
      end: generic.index + generic[0].length,
    };
  }
  return null;
}

function looksLikeMedication(
  input: string,
  medications?: { name: string }[]
): boolean {
  if (
    /\b(?:meds?|medication|medicine|pills?|rx)\b/i.test(input) ||
    /\b(?:add|create|new|set|edit|update|change)\s+(?:my\s+)?(?:meds?|medication|medicine|pills?)\b/i.test(
      input
    )
  ) {
    return true;
  }
  // "take metformin 500mg at 8am"
  if (
    /\btake\b/i.test(input) &&
    /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|g|ml|iu|units?|tabs?|tablets?|caps?|pills?)\b/i.test(
      input
    )
  ) {
    return true;
  }
  // Edit by name: "edit metformin to 9am" / "change vitamin d remind 30 min"
  if (medications?.length) {
    const lower = input.toLowerCase();
    const named = medications.some(
      (m) => m.name && lower.includes(m.name.toLowerCase())
    );
    if (named && /\b(edit|update|change)\b/i.test(input)) {
      return true;
    }
  }
  return false;
}

function formatHhMm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractDosage(text: string): {
  value: string;
  start: number;
  end: number;
} | null {
  const m =
    /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|g|ml|mL|iu|IU|units?|tabs?|tablets?|caps?|pills?))\b/.exec(
      text
    );
  if (!m) return null;
  return {
    value: m[1].replace(/\s+/g, " ").trim(),
    start: m.index,
    end: m.index + m[0].length,
  };
}

function extractMedTimes(text: string): {
  times: string[];
  ranges: { start: number; end: number }[];
} | null {
  const times: string[] = [];
  const ranges: { start: number; end: number }[] = [];
  const add = (hhmm: string, start: number, end: number) => {
    if (!times.includes(hhmm)) times.push(hhmm);
    ranges.push({ start, end });
  };

  const freq =
    /\b(once|twice|(?:2|3|two|three)\s+times)\s+(?:a\s+|per\s+)?day\b/i.exec(
      text
    );
  if (freq) {
    const w = freq[1].toLowerCase();
    if (w === "once") {
      add("08:00", freq.index, freq.index + freq[0].length);
    } else if (w.includes("twice") || w.startsWith("2") || w.includes("two")) {
      add("08:00", freq.index, freq.index + freq[0].length);
      add("20:00", freq.index, freq.index + freq[0].length);
    } else {
      add("08:00", freq.index, freq.index + freq[0].length);
      add("14:00", freq.index, freq.index + freq[0].length);
      add("20:00", freq.index, freq.index + freq[0].length);
    }
  }

  const atBlock =
    /\bat\s+((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)(?:\s*(?:,|&|\/|and)\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight))*)/gi;
  let atMatch: RegExpExecArray | null;
  while ((atMatch = atBlock.exec(text))) {
    const chunk = atMatch[1];
    const clockRe =
      /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)/gi;
    let clock: RegExpExecArray | null;
    let any = false;
    while ((clock = clockRe.exec(chunk))) {
      const parsed = parseClockTime(clock[1]);
      if (!parsed) continue;
      add(formatHhMm(parsed.hour, parsed.minute), atMatch.index, atMatch.index + atMatch[0].length);
      any = true;
    }
    if (!any) {
      // fall through — don't consume the match
    }
  }

  // Loose clock times not already captured (e.g. "8am, 8pm" without "at")
  const loose =
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight)\b/gi;
  let looseMatch: RegExpExecArray | null;
  while ((looseMatch = loose.exec(text))) {
    const overlapping = ranges.some(
      (r) => looseMatch!.index >= r.start && looseMatch!.index < r.end
    );
    if (overlapping) continue;
    const parsed = parseClockTime(looseMatch[1]);
    if (!parsed) continue;
    add(
      formatHhMm(parsed.hour, parsed.minute),
      looseMatch.index,
      looseMatch.index + looseMatch[0].length
    );
  }

  const periods: { re: RegExp; time: string }[] = [
    { re: /\b(mornings?)\b/i, time: "08:00" },
    { re: /\b(afternoons?)\b/i, time: "14:00" },
    { re: /\b(evenings?)\b/i, time: "18:00" },
    { re: /\b(nights?|bedtime|before\s+bed)\b/i, time: "21:00" },
  ];
  for (const p of periods) {
    const m = p.re.exec(text);
    if (!m) continue;
    const overlapping = ranges.some(
      (r) => m.index >= r.start && m.index < r.end
    );
    if (overlapping) continue;
    add(p.time, m.index, m.index + m[0].length);
  }

  if (!times.length) return null;
  times.sort();
  return { times, ranges };
}

function stripMedCommands(text: string): string {
  return text
    .replace(
      /\b(?:add|create|new|set|edit|update|change)\s+(?:my\s+)?(?:meds?|medication|medicine|pills?)\b[.!]?\s*/gi,
      " "
    )
    .replace(/\b(?:meds?|medication|medicine|pills?|rx)\b[:.]?\s*/gi, " ")
    .replace(/\b(?:take|taking)\b/gi, " ")
    .replace(/\b(?:every\s+day|daily|each\s+day)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(
  input: string,
  kind: "ticket" | "event",
  hasSeries: boolean,
  isMed: boolean
): SmartParseIntent {
  if (isMed) return "medication";
  if (hasSeries) return "event_series";
  if (/\bset\s+events?\b/i.test(input)) return "event";
  if (/\b(?:class|course)\s+schedule\b/i.test(input)) return "event";
  if (/\bschedule\b/i.test(input) && kind === "event") return "event";
  return kind;
}

export function smartParse(
  input: string,
  context: ParseContext,
  kind: "ticket" | "event" = "ticket"
): SmartParseResult {
  let text = input.trim();
  const hints: string[] = [];
  let confidence = 0.2;
  const isMed = looksLikeMedication(input, context.medications);

  const result: SmartParseResult = {
    title: text,
    cleanedText: text,
    intent: kind,
    dueAt: null,
    startAt: null,
    endAt: null,
    allDay: false,
    status: kind === "ticket" && !isMed ? "Ready" : null,
    priority: kind === "ticket" && !isMed ? "P2" : null,
    energy: null,
    estimateMin: null,
    projectId: null,
    projectName: null,
    assigneeId: null,
    assigneeName: null,
    contactId: null,
    contactName: null,
    waitingOn: null,
    isFocus: kind === "ticket" && !isMed,
    eventType: kind === "event" ? "personal" : null,
    recurrence: null,
    untilAt: null,
    remindMinutesBefore: null,
    durationMinutes: 60,
    medicationId: null,
    dosage: null,
    medTimes: null,
    confidence,
    hints,
  };

  if (!text) return result;

  // --- Series / schedule extraction first (before chrono eats weekdays) ---
  // Skip series/until for medications — dose times are daily HH:mm slots.
  const untilHit = !isMed ? extractUntil(text) : null;
  if (untilHit) {
    result.untilAt = untilHit.untilAt.toISOString();
    text = stripRange(text, untilHit.start, untilHit.end);
    hints.push(`Until: ${untilHit.label}`);
    confidence += 0.15;
  }

  const remindHit = extractReminders(text);
  if (remindHit) {
    result.remindMinutesBefore = remindHit.minutes;
    text = stripRange(text, remindHit.start, remindHit.end);
    hints.push(`Reminder: ${remindHit.minutes}m before`);
    confidence += 0.1;
  }

  const recurHit = !isMed ? extractRecurrence(text) : null;
  if (recurHit) {
    result.recurrence = recurHit.recurrence;
    text = stripRange(text, recurHit.start, recurHit.end);
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = recurHit.recurrence.byWeekday.map((d) => labels[d]).join(", ");
    const hh = String(recurHit.recurrence.timeHour).padStart(2, "0");
    const mm = String(recurHit.recurrence.timeMinute).padStart(2, "0");
    hints.push(`Repeats: ${days} at ${hh}:${mm}`);
    confidence += 0.25;
  }

  // Default until for weekly series: 3 months if not specified
  if (result.recurrence && !result.untilAt) {
    result.untilAt = addDurationFromNow(3, "months").toISOString();
    hints.push("Until: next 3 months (default)");
  }

  result.intent = detectIntent(input, kind, Boolean(result.recurrence), isMed);
  if (result.intent === "event_series" || result.intent === "event") {
    if (result.eventType == null) result.eventType = "personal";
  }

  // --- Medication branch ---
  if (result.intent === "medication") {
    const doseHit = extractDosage(text);
    if (doseHit) {
      result.dosage = doseHit.value;
      text = stripRange(text, doseHit.start, doseHit.end);
      hints.push(`Dosage: ${doseHit.value}`);
      confidence += 0.15;
    }

    const timesHit = extractMedTimes(text);
    if (timesHit) {
      // Strip ranges from end to start so indices stay valid
      const sorted = [...timesHit.ranges].sort((a, b) => b.start - a.start);
      const seen = new Set<string>();
      for (const r of sorted) {
        const key = `${r.start}:${r.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        text = stripRange(text, r.start, r.end);
      }
      result.medTimes = timesHit.times;
      hints.push(`Times: ${timesHit.times.join(", ")}`);
      confidence += 0.25;
    }

    if (result.remindMinutesBefore == null) {
      result.remindMinutesBefore = 15;
      hints.push("Reminder: 15m before (default)");
    }

    text = stripMedCommands(text);

    if (context.medications?.length) {
      const medHit = matchEntity(
        text.length >= 2 ? text : input,
        context.medications.map((m) => ({ id: m.id, name: m.name })),
        (m) => m.name
      );
      if (medHit) {
        result.medicationId = medHit.item.id;
        const existing = context.medications.find((m) => m.id === medHit.item.id);
        text = stripRange(
          text.length >= 2 ? text : input,
          medHit.index,
          medHit.index + medHit.length
        );
        text = stripMedCommands(text);
        result.title =
          existing?.name ||
          medHit.item.name.charAt(0).toUpperCase() + medHit.item.name.slice(1);
        if (!result.dosage && existing?.dosage) {
          result.dosage = existing.dosage;
        }
        if (!result.medTimes?.length && existing?.times?.length) {
          result.medTimes = existing.times;
          hints.push(`Times: ${existing.times.join(", ")} (kept)`);
        }
        if (
          remindHit == null &&
          existing?.remindMinutesBefore != null &&
          result.remindMinutesBefore === 15
        ) {
          result.remindMinutesBefore = existing.remindMinutesBefore;
        }
        hints.push(`Edit med: ${result.title}`);
        confidence += 0.2;
      }
    }

    text = text
      .replace(/\s+[^\w\s&/'’-]\s+/g, " ")
      .replace(/\b(and|or|too)\b/gi, " ")
      .replace(/\b(for|in|on|at|by|to|with|about)\s*$/i, "")
      .replace(/^\s*(for|in|on|at|by|to|with|about|and)\b/i, "")
      .replace(/[.\s,;:!-]+$/g, "")
      .replace(/^[.\s,;:!-]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!result.medicationId) {
      if (text.length < 2) {
        text = stripMedCommands(input.trim());
        if (doseHit) text = stripRange(text, doseHit.start, doseHit.end);
        if (timesHit) {
          const sorted = [...timesHit.ranges].sort((a, b) => b.start - a.start);
          const seen = new Set<string>();
          for (const r of sorted) {
            const key = `${r.start}:${r.end}`;
            if (seen.has(key)) continue;
            seen.add(key);
            text = stripRange(text, r.start, r.end);
          }
        }
        text = stripMedCommands(text);
      }
      result.title = text
        ? text.charAt(0).toUpperCase() + text.slice(1)
        : "Medication";
    } else if (text.length >= 2 && !context.medications?.some((m) => m.name.toLowerCase() === text.toLowerCase())) {
      // leftover words after matching existing med name — treat as note-ish title keep
      // Keep the matched medication name as title (already set)
    }

    result.cleanedText = result.title;
    result.confidence = Math.min(0.98, confidence);
    return result;
  }

  // Strip command filler like "Set events."
  const setEvents = /\bset\s+events?\b[.!]?\s*/gi;
  if (setEvents.test(text)) {
    text = text.replace(setEvents, " ").replace(/\s+/g, " ").trim();
    confidence += 0.05;
  }
  text = text
    .replace(/\bset\s+the\s+event\b[.!]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parseKind: "ticket" | "event" =
    result.intent === "ticket" ? "ticket" : "event";

  // For series, chrono is optional (time already on recurrence)
  const dateResults = chrono.parse(text, new Date(), { forwardDate: true });
  if (result.intent === "event_series" && result.recurrence) {
    // Seed startAt/endAt from first upcoming occurrence for preview chips
    const now = new Date();
    const seed = new Date(now);
    seed.setHours(result.recurrence.timeHour, result.recurrence.timeMinute, 0, 0);
    // find next matching weekday
    for (let i = 0; i < 8; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(result.recurrence.timeHour, result.recurrence.timeMinute, 0, 0);
      if (
        result.recurrence.byWeekday.includes(d.getDay() as JsWeekday) &&
        d.getTime() >= now.getTime() - 60_000
      ) {
        result.startAt = d.toISOString();
        result.endAt = new Date(
          d.getTime() + result.durationMinutes * 60_000
        ).toISOString();
        break;
      }
    }
    // Still strip any leftover chrono fragments that duplicate weekdays/times
    if (dateResults[0]) {
      text = stripRange(
        text,
        dateResults[0].index,
        dateResults[0].index + dateResults[0].text.length
      );
    }
  } else if (dateResults[0]) {
    const dr = dateResults[0];
    const start = dr.start.date();
    const end = dr.end?.date() || new Date(start.getTime() + 60 * 60 * 1000);
    const hasTime =
      dr.start.isCertain("hour") ||
      dr.start.isCertain("minute") ||
      /\b(am|pm|noon|midnight|\d{1,2}:\d{2})\b/i.test(dr.text);

    result.allDay = !hasTime && parseKind === "event";
    if (parseKind === "event") {
      if (result.allDay) {
        const day = new Date(start);
        day.setHours(0, 0, 0, 0);
        result.startAt = day.toISOString();
        const endDay = new Date(day);
        endDay.setHours(23, 59, 0, 0);
        result.endAt = endDay.toISOString();
      } else {
        result.startAt = start.toISOString();
        result.endAt = end.toISOString();
      }
      hints.push(`Time: ${dr.text}`);
    } else {
      result.dueAt = start.toISOString();
      hints.push(`Due: ${dr.text}`);
    }
    text = stripRange(text, dr.index, dr.index + dr.text.length);
    confidence += 0.25;
  } else if (parseKind === "ticket") {
    result.dueAt = new Date().toISOString();
    hints.push("Due: today (default)");
  } else {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
    result.startAt = fallback.toISOString();
    result.endAt = new Date(fallback.getTime() + 60 * 60 * 1000).toISOString();
    hints.push("Time: in 1 hour (default)");
  }

  const projectHit = matchEntity(
    text,
    context.projects.map((p) => ({ ...p, name: p.name })),
    (p) => p.name
  );
  if (projectHit) {
    result.projectId = projectHit.item.id;
    result.projectName = projectHit.item.name;
    const around = new RegExp(
      `\\b(?:for|in|on|under)\\s+${escapeRegExp(projectHit.item.name)}\\b|\\b${escapeRegExp(projectHit.item.name)}\\b`,
      "i"
    );
    const m = around.exec(text);
    if (m) text = stripRange(text, m.index, m.index + m[0].length);
    else
      text = stripRange(
        text,
        projectHit.index,
        projectHit.index + projectHit.length
      );
    hints.push(`Project: ${projectHit.item.name}`);
    confidence += 0.2;
  }

  const estEarly = extractEstimate(text);
  if (estEarly) {
    result.estimateMin = estEarly.minutes;
    text = stripRange(text, estEarly.start, estEarly.end);
    hints.push(`Estimate: ${estEarly.minutes}m`);
    confidence += 0.05;
  }

  const waiting = extractWaitingOn(text);
  if (waiting) {
    result.waitingOn = waiting.value;
    result.status = "Waiting";
    text = stripRange(text, waiting.start, waiting.end);
    hints.push(`Waiting on: ${waiting.value}`);
    confidence += 0.1;
  }

  const assignPhrase =
    /(?:^|\s)(?:for|assign(?:ed)?\s+to|@)\s*([A-Za-z][\w.-]{1,30})/i.exec(text);
  if (assignPhrase) {
    const name = assignPhrase[1];
    const found = context.members.find((m) =>
      (m.name || m.email).toLowerCase().includes(name.toLowerCase())
    );
    if (found) {
      result.assigneeId = found.id;
      result.assigneeName = found.name || found.email;
      text = stripRange(
        text,
        assignPhrase.index,
        assignPhrase.index + assignPhrase[0].length
      );
      hints.push(`Owner: ${result.assigneeName}`);
      confidence += 0.15;
    }
  }
  if (!result.assigneeId) {
    const memberHit = matchEntity(
      text,
      context.members.map((m) => ({
        id: m.id,
        name: m.name || m.email.split("@")[0],
        email: m.email,
      })),
      (m) => m.name || ""
    );
    if (memberHit) {
      result.assigneeId = memberHit.item.id;
      result.assigneeName = memberHit.item.name;
      text = stripRange(
        text,
        memberHit.index,
        memberHit.index + memberHit.length
      );
      hints.push(`Owner: ${memberHit.item.name}`);
      confidence += 0.15;
    }
  }

  if (context.contacts?.length) {
    if (result.waitingOn) {
      const matchContact = context.contacts.find((c) =>
        result.waitingOn!.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matchContact) {
        result.contactId = matchContact.id;
        result.contactName = matchContact.name;
        hints.push(`Contact: ${matchContact.name}`);
        confidence += 0.05;
      }
    }
    if (!result.contactId) {
      const contactHit = matchEntity(text, context.contacts, (c) => c.name);
      if (contactHit) {
        result.contactId = contactHit.item.id;
        result.contactName = contactHit.item.name;
        text = stripRange(
          text,
          contactHit.index,
          contactHit.index + contactHit.length
        );
        hints.push(`Contact: ${contactHit.item.name}`);
        confidence += 0.1;
      }
    }
  }

  for (const p of STATUS_PATTERNS) {
    if (result.waitingOn && p.status === "Waiting") continue;
    const m = p.re.exec(text);
    if (m) {
      result.status = p.status;
      text = stripRange(text, m.index, m.index + m[0].length);
      hints.push(`Status: ${p.status}`);
      confidence += 0.1;
      break;
    }
  }

  for (const p of PRIORITY_PATTERNS) {
    const m = p.re.exec(text);
    if (m) {
      result.priority = p.priority;
      text = stripRange(text, m.index, m.index + m[0].length);
      hints.push(`Priority: ${p.priority}`);
      confidence += 0.1;
      break;
    }
  }

  for (const p of ENERGY_PATTERNS) {
    const m = p.re.exec(text);
    if (m) {
      result.energy = p.energy;
      text = stripRange(text, m.index, m.index + m[0].length);
      hints.push(`Energy: ${p.energy}`);
      confidence += 0.05;
      break;
    }
  }

  if (result.estimateMin == null) {
    const est = extractEstimate(text);
    if (est) {
      result.estimateMin = est.minutes;
      text = stripRange(text, est.start, est.end);
      hints.push(`Estimate: ${est.minutes}m`);
      confidence += 0.05;
    }
  }

  if (parseKind === "event") {
    for (const p of EVENT_TYPE_PATTERNS) {
      const m = p.re.exec(text);
      if (m) {
        result.eventType = p.type;
        hints.push(`Type: ${p.type}`);
        confidence += 0.05;
        break;
      }
    }
  }

  if (/\b(focus|must[- ]?do|today'?s? priority)\b/i.test(input)) {
    result.isFocus = true;
    hints.push("Focus: starred");
  }

  text = text
    .replace(/\s+[^\w\s&/'’-]\s+/g, " ")
    .replace(/\b(and|or|too)\b/gi, " ")
    .replace(/\b(for|in|on|at|by|to|with|about)\s*$/i, "")
    .replace(/^\s*(for|in|on|at|by|to|with|about|and)\b/i, "")
    .replace(/[.\s,;:!-]+$/g, "")
    .replace(/^[.\s,;:!-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 2) {
    text = input.trim();
    if (recurHit) text = stripRange(text, recurHit.start, recurHit.end);
    if (untilHit) {
      // re-strip by phrase if still present
      text = text.replace(untilHit.label, " ").replace(/\s+/g, " ").trim();
    }
  }

  result.title = text.charAt(0).toUpperCase() + text.slice(1);
  result.cleanedText = result.title;
  result.confidence = Math.min(0.98, confidence);

  // Promote ticket+recurrence to series
  if (result.recurrence && result.untilAt) {
    result.intent = "event_series";
  }

  return result;
}
