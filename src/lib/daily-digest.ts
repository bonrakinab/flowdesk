import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/app-url";
import { buildTodayDoses, wallDayFor } from "@/lib/meds";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import type { Prisma } from "@prisma/client";

type DigestUser = {
  id: string;
  email: string;
  name: string | null;
  householdId: string | null;
  alertEmail: boolean;
  tzOffsetMinutes: number | null;
};

type DigestResult = {
  sent: boolean;
  skipped?: "disabled" | "no-household" | "smtp-not-configured" | "duplicate" | "empty";
  error?: string;
  items?: number;
  dayKey?: string;
};

function dayContext(now: Date, tzOffsetMinutes: number | null) {
  const offset = Number.isFinite(tzOffsetMinutes) ? Number(tzOffsetMinutes) : 0;
  const wall = new Date(now.getTime() - offset * 60_000);
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth();
  const day = wall.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) + offset * 60_000);
  const end = new Date(Date.UTC(year, month, day + 1) + offset * 60_000);
  const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const label = wall.toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return { offset, start, end, dayKey, label };
}

function formatLocalTime(date: Date, offset: number) {
  const wall = new Date(date.getTime() - offset * 60_000);
  return wall.toLocaleTimeString("en-CA", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function link(href: string) {
  return `${appBaseUrl()}${href}`;
}

function section(title: string, rows: string[]) {
  if (rows.length === 0) return "";
  return `
    <div style="margin:20px 0 0">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#78716c;margin-bottom:8px">${escapeHtml(title)}</div>
      <div style="border:1px solid #e7e5e4;border-radius:14px;overflow:hidden;background:#fff">
        ${rows.join("")}
      </div>
    </div>
  `;
}

function row(title: string, meta: string, href?: string) {
  const safeTitle = escapeHtml(title);
  const safeMeta = escapeHtml(meta);
  const body = `
    <div style="padding:12px 14px;border-bottom:1px solid #f5f5f4">
      <div style="font-size:14px;font-weight:650;color:#1c1917">${safeTitle}</div>
      <div style="font-size:12px;color:#78716c;margin-top:3px">${safeMeta}</div>
    </div>
  `;
  return href ? `<a href="${href}" style="text-decoration:none;color:inherit;display:block">${body}</a>` : body;
}

export async function dispatchDailyDigestForUser(
  user: DigestUser,
  options: { force?: boolean } = {}
): Promise<DigestResult> {
  if (!user.alertEmail && !options.force) return { sent: false, skipped: "disabled" };
  const householdId = user.householdId;
  if (!householdId) return { sent: false, skipped: "no-household" };
  if (!isSmtpConfigured()) return { sent: false, skipped: "smtp-not-configured" };

  const now = new Date();
  const { offset, start, end, dayKey, label } = dayContext(now, user.tzOffsetMinutes);
  const alertKey = `daily-digest:${dayKey}`;

  if (!options.force) {
    const existing = await prisma.alertDelivery.findUnique({
      where: {
        userId_alertKey_channel: {
          userId: user.id,
          alertKey,
          channel: "email",
        },
      },
    });
    if (existing) return { sent: false, skipped: "duplicate", dayKey };
  }

  const assignmentScope: Prisma.TicketWhereInput[] = [
    { assigneeId: user.id },
    { assigneeId: null },
    { assignees: { some: { userId: user.id } } },
  ];

  const [tickets, events, reminders, meds] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        householdId,
        status: { not: "Done" },
        AND: [
          { OR: assignmentScope },
          {
            OR: [
              { dueAt: { lt: end } },
              { isFocus: true },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        isFocus: true,
        priority: true,
        status: true,
      },
      orderBy: [{ dueAt: "asc" }, { priority: "asc" }],
      take: 40,
    }),
    prisma.calendarEvent.findMany({
      where: {
        householdId,
        status: { not: "done" },
        startAt: { lt: end },
        endAt: { gte: start },
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        allDay: true,
        type: true,
      },
      orderBy: { startAt: "asc" },
      take: 30,
    }),
    prisma.reminder.findMany({
      where: {
        done: false,
        remindAt: { gte: start, lt: end },
        OR: [
          { ticket: { householdId } },
          { event: { householdId } },
          {
            ticketId: null,
            eventId: null,
            OR: [
              { householdId },
              { userId: user.id },
            ],
          },
        ],
      },
      include: {
        ticket: { select: { id: true, title: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: { remindAt: "asc" },
      take: 30,
    }),
    prisma.medication.findMany({
      where: {
        householdId,
        userId: user.id,
        active: true,
      },
      include: {
        doseLogs: {
          where: {
            scheduledFor: {
              gte: new Date(start.getTime() - 12 * 60 * 60_000),
              lt: new Date(end.getTime() + 12 * 60 * 60_000),
            },
          },
        },
      },
    }),
  ]);

  const wallDay = wallDayFor(now, user.tzOffsetMinutes ?? undefined);
  const doses = buildTodayDoses(meds, wallDay, user.tzOffsetMinutes ?? undefined)
    .filter((dose) => !dose.takenAt && !dose.skipped);

  const overdue = tickets.filter((ticket) => ticket.dueAt && ticket.dueAt < start);
  const dueToday = tickets.filter(
    (ticket) => ticket.dueAt && ticket.dueAt >= start && ticket.dueAt < end
  );
  const focus = tickets.filter(
    (ticket) => ticket.isFocus && !overdue.includes(ticket) && !dueToday.includes(ticket)
  );

  const totalItems =
    overdue.length +
    dueToday.length +
    focus.length +
    events.length +
    reminders.length +
    doses.length;

  if (totalItems === 0) {
    return { sent: false, skipped: "empty", items: 0, dayKey };
  }

  const ticketRows = (items: typeof tickets, prefix?: string) =>
    items.map((ticket) =>
      row(
        ticket.title,
        `${prefix ? `${prefix} · ` : ""}${ticket.priority} · ${ticket.status}${
          ticket.dueAt ? ` · ${formatLocalTime(ticket.dueAt, offset)}` : ""
        }`,
        link(`/tickets/${ticket.id}`)
      )
    );

  const eventRows = events.map((event) =>
    row(
      event.title,
      event.allDay
        ? `All day · ${event.type}`
        : `${formatLocalTime(event.startAt, offset)}–${formatLocalTime(event.endAt, offset)} · ${event.type}`,
      link("/calendar")
    )
  );

  const reminderRows = reminders.map((reminder) =>
    row(
      reminder.title || reminder.ticket?.title || reminder.event?.title || "Reminder",
      formatLocalTime(reminder.remindAt, offset),
      reminder.ticketId
        ? link(`/tickets/${reminder.ticketId}`)
        : reminder.eventId
          ? link("/calendar")
          : link("/today")
    )
  );

  const medRows = doses.map((dose) =>
    row(
      dose.name,
      `${formatLocalTime(dose.scheduledFor, offset)}${dose.dosage ? ` · ${dose.dosage}` : ""}`,
      link("/meds")
    )
  );

  const firstName = user.name?.trim().split(/\s+/)[0] || "there";
  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#1c1917">
        <div style="max-width:640px;margin:0 auto;padding:28px 16px">
          <div style="background:#0f766e;color:white;border-radius:18px;padding:22px 24px">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Flowdesk Daily Brief</div>
            <div style="font-size:25px;font-weight:700;margin-top:6px">Good morning, ${escapeHtml(firstName)}.</div>
            <div style="font-size:14px;opacity:.85;margin-top:6px">${escapeHtml(label)} · ${totalItems} item${totalItems === 1 ? "" : "s"} on your radar</div>
          </div>

          ${section("Overdue", ticketRows(overdue, "Overdue"))}
          ${section("Due today", ticketRows(dueToday))}
          ${section("Focus", ticketRows(focus, "Focus"))}
          ${section("Events", eventRows)}
          ${section("Reminders", reminderRows)}
          ${section("Medication", medRows)}

          <div style="margin-top:22px;text-align:center">
            <a href="${link("/today")}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:650">Open Today in Flowdesk</a>
          </div>
          <div style="font-size:11px;color:#a8a29e;text-align:center;margin-top:18px">
            Sent because Email alerts are enabled in Flowdesk Account settings.
          </div>
        </div>
      </body>
    </html>
  `;

  const textSections = [
    overdue.length ? `Overdue:\n${overdue.map((x) => `- ${x.title}`).join("\n")}` : "",
    dueToday.length ? `Due today:\n${dueToday.map((x) => `- ${x.title}`).join("\n")}` : "",
    focus.length ? `Focus:\n${focus.map((x) => `- ${x.title}`).join("\n")}` : "",
    events.length
      ? `Events:\n${events
          .map((x) => `- ${formatLocalTime(x.startAt, offset)} ${x.title}`)
          .join("\n")}`
      : "",
    reminders.length
      ? `Reminders:\n${reminders
          .map((x) => `- ${formatLocalTime(x.remindAt, offset)} ${x.title || x.ticket?.title || x.event?.title || "Reminder"}`)
          .join("\n")}`
      : "",
    doses.length
      ? `Medication:\n${doses
          .map((x) => `- ${formatLocalTime(x.scheduledFor, offset)} ${x.name}`)
          .join("\n")}`
      : "",
  ].filter(Boolean);

  const mail = await sendMail({
    to: user.email,
    subject: `Flowdesk · Today — ${label}`,
    html,
    text: `Good morning, ${firstName}.\n\n${textSections.join("\n\n")}\n\nOpen Flowdesk: ${link("/today")}`,
  });

  if (!mail.ok) {
    return { sent: false, error: mail.error || "Email send failed", items: totalItems, dayKey };
  }

  await prisma.alertDelivery.upsert({
    where: {
      userId_alertKey_channel: {
        userId: user.id,
        alertKey,
        channel: "email",
      },
    },
    create: { userId: user.id, alertKey, channel: "email" },
    update: {},
  });

  return { sent: true, items: totalItems, dayKey };
}

export async function dispatchDailyDigestsForAllUsers() {
  const users = await prisma.user.findMany({
    where: {
      householdId: { not: null },
      alertEmail: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      householdId: true,
      alertEmail: true,
      tzOffsetMinutes: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const result = await dispatchDailyDigestForUser(user);
    if (result.sent) sent += 1;
    else if (result.error) failed += 1;
    else skipped += 1;
  }

  return { users: users.length, sent, skipped, failed };
}
