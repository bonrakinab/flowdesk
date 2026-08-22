import { prisma } from "@/lib/db";
import { collectDueAlerts, type DueAlert } from "@/lib/alerts";
import { sendPushToUser, isPushConfigured } from "@/lib/push";
import { appBaseUrl } from "@/lib/app-url";

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

/** Push only — email/SMS disabled; in-app toasts handled by ReminderWatcher. */
export async function dispatchAlertsForUser(user: {
  id: string;
  email: string;
  householdId: string | null;
  alertEmail?: boolean;
  alertSms?: boolean;
  phone?: string | null;
}) {
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

  return {
    alerts: alerts.length,
    push,
    email: 0,
    sms: 0,
    items: alerts as DueAlert[],
  };
}

export async function dispatchAlertsForAllUsers() {
  const users = await prisma.user.findMany({
    where: {
      householdId: { not: null },
      pushSubs: { some: {} },
    },
    select: {
      id: true,
      email: true,
      householdId: true,
      alertEmail: true,
      alertSms: true,
      phone: true,
    },
  });

  let push = 0;
  let alerts = 0;
  for (const u of users) {
    const r = await dispatchAlertsForUser(u);
    push += r.push;
    alerts += r.alerts;
  }
  return { users: users.length, alerts, push, email: 0, sms: 0 };
}
