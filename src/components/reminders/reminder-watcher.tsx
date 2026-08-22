"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ensureNativeNotifications,
  isNativeApp,
  listenNativeNotificationTaps,
  showNativeAlert,
} from "@/lib/native-notify";

type AlertItem = {
  id: string;
  kind: "reminder" | "ticket" | "event" | "med";
  title: string;
  body: string;
  at: string;
  href?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function showBrowserAlert(a: AlertItem) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(a.title, {
        body: a.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: a.id,
        data: { url: a.href || "/today" },
      });
      return;
    }
  } catch {
    /* fall through to Notification constructor */
  }
  try {
    new Notification(a.title, {
      body: a.body,
      icon: "/icons/icon-192.png",
      tag: a.id,
    });
  } catch {
    /* ignore */
  }
}

export function ReminderWatcher() {
  const router = useRouter();
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [toasts, setToasts] = useState<AlertItem[]>([]);
  const native = typeof window !== "undefined" && isNativeApp();

  function presentAlert(a: AlertItem, opts?: { force?: boolean }) {
    const key = `alerted-${a.id}`;
    if (!opts?.force && sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    setToasts((prev) => {
      if (prev.some((p) => p.id === a.id)) return prev;
      return [...prev.slice(-4), a];
    });

    if (native) {
      void showNativeAlert({
        id: a.id,
        title: a.title,
        body: a.body,
        href: a.href,
      });
    } else {
      void showBrowserAlert(a);
    }
  }

  useEffect(() => {
    function onTest(ev: Event) {
      const detail = (ev as CustomEvent<Partial<AlertItem>>).detail || {};
      presentAlert(
        {
          id: detail.id || `test:${Date.now()}`,
          kind: detail.kind || "reminder",
          title: detail.title || "Test alert",
          body: detail.body || "In-app notifications are working.",
          at: detail.at || new Date().toISOString(),
          href: detail.href || "/today",
        },
        { force: true }
      );
    }
    window.addEventListener("flowdesk:test-alert", onTest);
    return () => window.removeEventListener("flowdesk:test-alert", onTest);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- presentAlert closes over native
  }, [native]);

  useEffect(() => {
    async function tick() {
      try {
        const tz = new Date().getTimezoneOffset();
        // 2h lookback + 15m ahead so opening the app still surfaces recent dues
        const dueQs = `pastMs=${2 * 60 * 60_000}&futureMs=${15 * 60_000}&tzOffset=${tz}`;
        const [dueRes, upcomingRes] = await Promise.all([
          fetch(`/api/alerts/due?${dueQs}`, { cache: "no-store" }),
          native
            ? fetch(
                `/api/alerts/due?pastMs=0&futureMs=21600000&tzOffset=${tz}`,
                { cache: "no-store" }
              )
            : Promise.resolve(null),
        ]);
        if (!dueRes.ok) return;
        const data = (await dueRes.json()) as { alerts: AlertItem[] };

        for (const a of data.alerts) {
          presentAlert(a);
        }

        if (native && upcomingRes?.ok) {
          const upcoming = (await upcomingRes.json()) as {
            alerts: AlertItem[];
          };
          for (const a of upcoming.alerts) {
            const schedKey = `scheduled-${a.id}`;
            if (sessionStorage.getItem(schedKey)) continue;
            const at = new Date(a.at);
            if (at.getTime() <= Date.now()) continue;
            sessionStorage.setItem(schedKey, "1");
            void showNativeAlert({
              id: `sched:${a.id}`,
              title: a.title,
              body: a.body,
              href: a.href,
              at,
            });
          }
        }

        // Push dispatch for browser notifications when tab is in background
        if (data.alerts.length > 0) {
          void fetch("/api/alerts/dispatch", { method: "POST" });
        }
      } catch {
        /* ignore */
      }
    }

    tick();
    const id = setInterval(tick, 20_000);
    const dispatchId = setInterval(() => {
      void fetch("/api/alerts/dispatch", { method: "POST" });
    }, 5 * 60_000);
    void fetch("/api/alerts/dispatch", { method: "POST" });
    return () => {
      clearInterval(id);
      clearInterval(dispatchId);
    };
  }, [native]);

  // Auto-dismiss toasts so the stack does not stick forever
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 14_000)
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [toasts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNativeApp()) {
      void ensureNativeNotifications().finally(() => {
        setPermissionAsked(true);
        setNotifPerm("granted");
      });
      return;
    }
    if (!("Notification" in window)) {
      setNotifPerm("unsupported");
      setPermissionAsked(true);
      return;
    }
    setNotifPerm(Notification.permission);
    setPermissionAsked(true);
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove = () => {};
    void listenNativeNotificationTaps((href) => {
      router.push(href);
    }).then((dispose) => {
      remove = dispose;
    });
    return () => remove();
  }, [router]);

  useEffect(() => {
    async function subscribePush() {
      if (isNativeApp()) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (!("Notification" in window) || Notification.permission !== "granted")
        return;
      try {
        const vapid = await fetch("/api/push/vapid").then((r) => r.json());
        if (!vapid.publicKey) return;

        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register("/sw.js");
        }
        await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
          });
        }
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          }),
        });
      } catch {
        /* VAPID unset or SW not ready */
      }
    }
    if (permissionAsked && notifPerm === "granted") void subscribePush();
  }, [permissionAsked, notifPerm]);

  async function enableNotifications() {
    if (isNativeApp()) {
      const ok = await ensureNativeNotifications();
      setNotifPerm(ok ? "granted" : "denied");
      return;
    }
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      await showBrowserAlert({
        id: "welcome",
        kind: "reminder",
        title: "Flowdesk",
        body: "In-app alerts are on for events, tickets, and meds.",
        at: new Date().toISOString(),
      });
    }
  }

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const showPermBanner =
    !native &&
    !bannerDismissed &&
    permissionAsked &&
    (notifPerm === "default" || notifPerm === "denied");

  return (
    <>
      {showPermBanner && (
        <div className="pointer-events-auto fixed left-1/2 top-3 z-[95] w-[min(100%-1.5rem,26rem)] -translate-x-1/2 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow)] md:top-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 shrink-0 text-accent" size={18} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">Enable in-app notifications</div>
              <p className="mt-0.5 text-xs text-muted">
                {notifPerm === "denied"
                  ? "Blocked in browser settings — allow notifications for this site, then reload."
                  : "Allow pop-ups so due items show even when Flowdesk is in another tab."}
              </p>
              {notifPerm === "default" && (
                <button
                  type="button"
                  onClick={() => void enableNotifications()}
                  className="mt-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-white"
                >
                  Allow notifications
                </button>
              )}
              {notifPerm === "denied" && (
                <Link
                  href="/account"
                  className="mt-2 inline-block text-xs text-accent underline"
                >
                  Account · Alerts
                </Link>
              )}
            </div>
            <button
              type="button"
              className="text-muted hover:text-foreground"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-24 md:bottom-6 right-4 z-[90] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-2xl border border-border bg-card shadow-[var(--shadow)] px-4 py-3 flex gap-3 animate-in fade-in slide-in-from-bottom-2",
              t.kind === "med" && "border-accent/40",
              t.kind === "ticket" && "border-warm/40",
              t.kind === "event" && "border-blue-400/40"
            )}
          >
            <Bell className="mt-0.5 shrink-0 text-accent" size={16} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted">
                {t.title}
              </div>
              {t.href ? (
                <Link
                  href={t.href}
                  className="font-medium text-sm hover:text-accent"
                  onClick={() => dismiss(t.id)}
                >
                  {t.body}
                </Link>
              ) : (
                <div className="font-medium text-sm">{t.body}</div>
              )}
            </div>
            <button
              type="button"
              className="text-muted hover:text-foreground shrink-0"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
