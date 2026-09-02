import { prisma } from "@/lib/db";
import { collectDueAlerts, type DueAlert } from "@/lib/alerts";
import { sendPushToUser, isPushConfigured } from "@/lib/push";
import { appBaseUrl } from "@/lib/app-url";
import { isSmtpConfigured, sendMail } from "@/lib/mail";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAlertTime(iso: string, tzOffsetMinutes?: number | null) {
  const value = new Date(iso);
  const offset = Number.isFinite(tzOffsetMinutes) ? Number(tzOffsetMinutes) : 0;
  const wall = new Date(value.getTime() - offset * 60_000);
  return wall.toLocaleString("en-CA", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function alreadySent(
  userId: string,
  alertKey: string,
  channel: string
) {
  const row = await prisma.alertDelivery.findUnique({
    where: {
      userId_alertKey_channel: { userId, alertKey, channel },
    },
  });
  return Boolean(row);
}

async function markSent(
  userId: string,
  alertKey: string,
  channel: string
) {
  await prisma.alertDelivery.upsert({
    where: {
      userId_alertKey_channel: { userId, alertKey, channel },
    },
    create: { userId, alertKey, channel },
    update: {},
  });
}

/** Push + email delivery; in-app toasts are handled by ReminderWatcher. */
export async function dispatchAlertsForUser(
  user: {
    id: string;
    email: string;
    householdId: string | null;
    alertEmail?: boolean;
    alertSms?: boolean;
    phone?: string | null;
    tzOffsetMinutes?: number | null;
  },
  options: { email?: boolean } = {}
) {
  if (!user.householdId) {
    return { alerts: 0, push: 0, email: 0, sms: 0 };
  }

  const alerts = await collectDueAlerts({
    householdId: user.householdId,
    userId: user.id,
    pastMs: 24 * 60 * 60_000,
    futureMs: 15 * 60_000,
  });

  let push = 0;
  let email = 0;
  const baseUrl = appBaseUrl();

  if (isPushConfigured()) {
    for (const a of alerts) {
      if (await alreadySent(user.id, a.id, "push")) continue;
      const result = await sendPushToUser(user.id, {
        title: a.title,
        body: a.body,
        url: a.href ? `${baseUrl}${a.href}` : `${baseUrl}/today`,
      });
      if (result.sent > 0) {
        push += result.sent;
        await markSent(user.id, a.id, "push");
      }
    }
  }

  if (options.email !== false && user.alertEmail && isSmtpConfigured()) {
    for (const a of alerts) {
      if (await alreadySent(user.id, a.id, "email")) continue;
      const href = a.href ? `${baseUrl}${a.href}` : `${baseUrl}/today`;
      const when = formatAlertTime(a.at, user.tzOffsetMinutes);
      const safeTitle = escapeHtml(a.title);
      const safeBody = escapeHtml(a.body);
      const mail = await sendMail({
        to: user.email,
        subject: `Flowdesk · ${a.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2 style="margin-bottom:6px">${safeTitle}</h2>
          <p style="font-size:16px">${safeBody}</p>
          <p style="color:#78716c;font-size:13px">${when}</p>
          <p><a href="${href}">Open in Flowdesk</a></p>
        </div>`,
        text: `${a.title}\n${a.body}\n${when}\n${href}`,
      });
      if (mail.ok) {
        email += 1;
        await markSent(user.id, a.id, "email");
      }
    }
  }

  return {
    alerts: alerts.length,
    push,
    email,
    sms: 0,
    items: alerts as DueAlert[],
  };
}

export async function dispatchAlertsForAllUsers(
  options: { email?: boolean } = {}
) {
  const users = await prisma.user.findMany({
    where: {
      householdId: { not: null },
      OR: [{ pushSubs: { some: {} } }, { alertEmail: true }],
    },
    select: {
      id: true,
      email: true,
      householdId: true,
      alertEmail: true,
      alertSms: true,
      phone: true,
      tzOffsetMinutes: true,
    },
  });

  let push = 0;
  let email = 0;
  let alerts = 0;
  for (const u of users) {
    const r = await dispatchAlertsForUser(u, options);
    push += r.push;
    email += r.email;
    alerts += r.alerts;
  }
  return { users: users.length, alerts, push, email, sms: 0 };
}
