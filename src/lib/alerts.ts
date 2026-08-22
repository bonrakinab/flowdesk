import { prisma } from "@/lib/db";
import {
  buildDosesInRange,
  wallDayFor,
} from "@/lib/meds";

export type DueAlert = {
  id: string;
  kind: "reminder" | "ticket" | "event" | "med";
  title: string;
  body: string;
  at: string;
  href?: string;
};

export async function collectDueAlerts(opts: {
  householdId: string;
  userId: string;
  pastMs?: number;
  futureMs?: number;
  tzOffsetMinutes?: number | null;
}): Promise<DueAlert[]> {
  // Wider window so 20s client polls (and rare cron ticks) still catch dues.
  const pastMs = opts.pastMs ?? 900_000; // 15 min
  const futureMs = opts.futureMs ?? 300_000; // 5 min
  const now = Date.now();
  const from = new Date(now - pastMs);
  const to = new Date(now + futureMs);
  const alerts: DueAlert[] = [];

  let tzOffset = opts.tzOffsetMinutes;
  if (tzOffset == null || !Number.isFinite(tzOffset)) {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { tzOffsetMinutes: true },
    });
    tzOffset = user?.tzOffsetMinutes ?? undefined;
  }

  const reminders = await prisma.reminder.findMany({
    where: {
      done: false,
      remindAt: { gte: from, lte: to },
      OR: [
        { ticket: { householdId: opts.householdId } },
        { event: { householdId: opts.householdId } },
        // Standalone reminders scoped to household / user
        {
          ticketId: null,
          eventId: null,
          OR: [
            { householdId: opts.householdId },
            { userId: opts.userId },
          ],
        },
      ],
    },
    include: {
      ticket: { select: { id: true, title: true } },
      event: { select: { id: true, title: true } },
    },
  });

  for (const r of reminders) {
    alerts.push({
      id: `reminder:${r.id}`,
      kind: "reminder",
      title: "Reminder",
      body: r.title || r.ticket?.title || r.event?.title || "Reminder",
      at: r.remindAt.toISOString(),
      href: r.ticketId
        ? `/tickets/${r.ticketId}`
        : r.eventId
          ? "/calendar"
          : undefined,
    });
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      householdId: opts.householdId,
      status: { not: "Done" },
      dueAt: { gte: from, lte: to },
      OR: [
        { assigneeId: opts.userId },
        { assigneeId: null },
        { assignees: { some: { userId: opts.userId } } },
      ],
    },
    select: { id: true, title: true, dueAt: true },
  });

  for (const t of tickets) {
    if (!t.dueAt) continue;
    alerts.push({
      id: `ticket:${t.id}:${t.dueAt.toISOString()}`,
      kind: "ticket",
      title: "Ticket due",
      body: t.title,
      at: t.dueAt.toISOString(),
      href: `/tickets/${t.id}`,
    });
  }

  const events = await prisma.calendarEvent.findMany({
    where: {
      householdId: opts.householdId,
      startAt: { gte: from, lte: to },
    },
    select: { id: true, title: true, startAt: true },
  });

  for (const e of events) {
    alerts.push({
      id: `event:${e.id}:${e.startAt.toISOString()}`,
      kind: "event",
      title: "Event starting",
      body: e.title,
      at: e.startAt.toISOString(),
      href: "/calendar",
    });
  }

  // Med dose logs: cover the wall days that overlap the alert window
  const wallFrom = wallDayFor(from, tzOffset ?? undefined);
  const wallTo = wallDayFor(to, tzOffset ?? undefined);
  const logPadStart = new Date(wallFrom.getTime() - 12 * 60 * 60_000);
  const logPadEnd = new Date(wallTo.getTime() + 36 * 60 * 60_000);

  const meds = await prisma.medication.findMany({
    where: { householdId: opts.householdId, active: true },
    include: {
      doseLogs: {
        where: {
          scheduledFor: { gte: logPadStart, lte: logPadEnd },
        },
      },
    },
  });

  const doses = buildDosesInRange(meds, from, to, tzOffset ?? undefined);

  for (const d of doses) {
    if (d.takenAt || d.skipped) continue;
    const doseMs = d.scheduledFor.getTime();
    const lead = d.remindMinutesBefore || 0;
    const leadMs = doseMs - lead * 60_000;
    const body = d.dosage ? `${d.name} · ${d.dosage}` : d.name;

    if (lead > 0 && leadMs >= now - pastMs && leadMs <= now + futureMs) {
      alerts.push({
        id: `med:${d.medicationId}:${d.scheduledFor.toISOString()}:lead`,
        kind: "med",
        title: "Medication reminder",
        body,
        at: new Date(leadMs).toISOString(),
        href: "/meds",
      });
    }

    if (doseMs >= now - pastMs && doseMs <= now + futureMs) {
      alerts.push({
        id: `med:${d.medicationId}:${d.scheduledFor.toISOString()}:due`,
        kind: "med",
        title: "Medication due",
        body,
        at: d.scheduledFor.toISOString(),
        href: "/meds",
      });
    }
  }

  alerts.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return alerts;
}
