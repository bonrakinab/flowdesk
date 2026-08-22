/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        ["/today", "/board", "/finance", "/calendar", "/notes"].some((p) =>
          url.pathname.startsWith(p)
        ),
      handler: new NetworkFirst({
        cacheName: "flowdesk-pages",
        networkTimeoutSeconds: 5,
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/wallpaper"),
      handler: new NetworkOnly(),
    },
    {
      // Never cache live alert polling — stale empty responses hid in-app toasts.
      matcher: ({ url }) => url.pathname.startsWith("/api/alerts"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/tickets") ||
        url.pathname.startsWith("/api/finance") ||
        url.pathname.startsWith("/api/reminders"),
      handler: new NetworkFirst({
        cacheName: "flowdesk-api",
        networkTimeoutSeconds: 5,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() || "Reminder" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Flowdesk", {
      body: data.body || "Reminder",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/today" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url || "/today";
  event.waitUntil(self.clients.openWindow(url));
});

serwist.addEventListeners();
