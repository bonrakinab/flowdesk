"use client";

import { useEffect, useState } from "react";
import { flushOutbox } from "@/lib/offline-outbox";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine);
      try {
        const raw = localStorage.getItem("flowdesk-outbox");
        setQueued(raw ? (JSON.parse(raw) as unknown[]).length : 0);
      } catch {
        setQueued(0);
      }
    }
    sync();
    const onOnline = () => {
      sync();
      void flushOutbox().then(sync);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", sync);
    const id = setInterval(sync, 5000);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline && queued === 0) return null;

  return (
    <div className="bg-warm-soft text-warm text-center text-xs py-1.5 px-3">
      {offline
        ? "You’re offline — queued actions will sync when back online"
        : `${queued} queued action(s) syncing…`}
      {!offline && queued > 0 && (
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => void flushOutbox().then(() => setQueued(0))}
        >
          Retry
        </button>
      )}
    </div>
  );
}
