import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/** Stable numeric id for Android local notifications (must fit int32). */
export function notificationIdFromKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const id = Math.abs(hash);
  return id === 0 ? 1 : id;
}

export async function ensureNativeNotifications() {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");

  await LocalNotifications.createChannel({
    id: "flowdesk-alerts",
    name: "Flowdesk alerts",
    description: "Reminders, tickets, events, and meds",
    importance: 5,
    visibility: 1,
    sound: "default",
    vibration: true,
  });

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    perm = await LocalNotifications.requestPermissions();
  }
  return perm.display === "granted";
}

export async function showNativeAlert(opts: {
  id: string;
  title: string;
  body: string;
  href?: string;
  at?: Date;
}) {
  if (!isNativeApp()) return false;
  const granted = await ensureNativeNotifications();
  if (!granted) return false;

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const notifId = notificationIdFromKey(opts.id);
  const when = opts.at && opts.at.getTime() > Date.now() + 1500 ? opts.at : undefined;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notifId,
        title: opts.title,
        body: opts.body,
        channelId: "flowdesk-alerts",
        extra: { href: opts.href || "/today", alertKey: opts.id },
        ...(when
          ? { schedule: { at: when, allowWhileIdle: true } }
          : {}),
      },
    ],
  });
  return true;
}

export async function listenNativeNotificationTaps(
  onOpen: (href: string) => void
) {
  if (!isNativeApp()) return () => {};
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const handle = await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (event) => {
      const href =
        (event.notification.extra as { href?: string } | undefined)?.href ||
        "/today";
      onOpen(href);
    }
  );
  return () => {
    void handle.remove();
  };
}
