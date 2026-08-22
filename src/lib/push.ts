import webpush from "web-push";
import { prisma } from "@/lib/db";

export function isPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!isPushConfigured()) {
    return {
      sent: 0,
      failed: 0,
      skipped: true as const,
      errors: ["VAPID keys missing on server"],
    };
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: false as const,
      errors: ["No browser push subscription stored for this account"],
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || "/today",
        }),
        {
          TTL: 60 * 60,
          urgency: "high",
        }
      );
      sent++;
    } catch (e: unknown) {
      failed++;
      const status = (e as { statusCode?: number })?.statusCode;
      const message = e instanceof Error ? e.message : "push failed";
      errors.push(status ? `${status}: ${message}` : message);
      console.error("[push]", status, message);
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }

  return { sent, failed, skipped: false as const, errors };
}
