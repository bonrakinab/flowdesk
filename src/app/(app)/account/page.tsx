"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Link2,
  LogOut,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { ThemeToggle, PalettePicker, WallpaperControls } from "@/components/theme/theme-toggle";
import { cn, MEMBER_COLORS } from "@/lib/utils";

type Account = {
  id: string;
  name: string | null;
  email: string;
  color: string;
  passwordHash: string | null;
  alertEmail?: boolean;
  alertSms?: boolean;
  phone?: string | null;
  household: {
    id: string;
    name: string;
    inviteCode: string;
    users: { id: string; name: string | null; email: string; color: string }[];
  } | null;
  accounts: { provider: string; id: string; scope?: string | null }[];
};

type FlowCalendar = {
  id: string;
  name: string;
  color: string | null;
  externalSource: string | null;
  syncEnabled: boolean;
  _count?: { events: number };
};

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [calendars, setCalendars] = useState<FlowCalendar[]>([]);
  const [calMsg, setCalMsg] = useState("");
  const [calBusy, setCalBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

  const load = useCallback(async () => {
    const [res, cRes] = await Promise.all([
      fetch("/api/account"),
      fetch("/api/calendars"),
    ]);
    if (res.ok) {
      const data: Account = await res.json();
      setAccount(data);
      setName(data.name || "");
      setEmail(data.email);
      setColor(data.color);
    }
    if (cRes.ok) {
      const data = await cRes.json();
      setCalendars(data.calendars || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, color }),
    });
    if (res.ok) {
      setSaved(true);
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Update failed");
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPassword || undefined,
        newPassword,
      }),
    });
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Password update failed");
    }
  }

  async function regenerateInvite() {
    const res = await fetch("/api/household", { method: "POST" });
    if (res.ok) {
      const { inviteCode } = await res.json();
      setAccount((prev) =>
        prev?.household
          ? { ...prev, household: { ...prev.household, inviteCode } }
          : prev
      );
    }
  }

  async function unlinkGoogle() {
    const res = await fetch("/api/account/unlink?provider=google", {
      method: "DELETE",
    });
    if (res.ok) load();
    else {
      const data = await res.json();
      setError(data.error || "Unlink failed");
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account permanently? This cannot be undone."))
      return;
    await fetch("/api/account", { method: "DELETE" });
    await signOut({ redirect: false });
    router.push("/login");
  }

  async function copyInvite() {
    if (!account?.household) return;
    await navigator.clipboard.writeText(account.household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const hasGoogle = account?.accounts.some((a) => a.provider === "google");
  const googleAccount = account?.accounts.find((a) => a.provider === "google");
  const googleScope = googleAccount?.scope || "";
  const hasGoogleTasks =
    googleScope.includes("https://www.googleapis.com/auth/tasks.readonly") ||
    googleScope.includes("https://www.googleapis.com/auth/tasks");
  const hasGoogleCalendar =
    googleScope.includes("https://www.googleapis.com/auth/calendar.readonly") ||
    googleScope.includes("https://www.googleapis.com/auth/calendar");

  if (loading) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-10 w-48 rounded-xl bg-stone-200/70" />
          <div className="h-48 rounded-3xl bg-stone-200/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow="Settings" title="Account" />

        <Panel className="!p-0 overflow-hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-[#1f2933] to-[#0f766e] px-6 py-7 text-white">
            <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div
                className="grid h-16 w-16 place-items-center rounded-3xl text-2xl font-semibold text-white shadow-lg ring-2 ring-white/20"
                style={{ background: color }}
              >
                {(name || "U").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl">
                  {name || "Your profile"}
                </div>
                <div className="text-sm text-white/70">{email}</div>
                {account?.household && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wider text-white/80">
                    <Users size={12} />
                    {account.household.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {(error || saved) && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm",
              error
                ? "border border-rose-200 bg-rose-50 text-danger dark:border-rose-900/50 dark:bg-rose-950/40"
                : "border border-teal-200 bg-accent-soft text-accent dark:border-teal-900/40"
            )}
          >
            {error || "Saved successfully"}
          </div>
        )}

        <Panel>
          <PanelHeader
            title="Appearance"
            description="Light/dark mode, color themes, and Bing wallpaper (live or static)."
          />
          <div className="space-y-6">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Mode
              </div>
              <ThemeToggle />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Theme
              </div>
              <PalettePicker />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Wallpaper
              </div>
              <WallpaperControls />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Profile" />
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Avatar color">
              <div className="flex flex-wrap gap-2.5">
                {MEMBER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-10 w-10 rounded-2xl border-2 transition",
                      color === c
                        ? "border-stone-900 scale-105 shadow-md"
                        : "border-transparent opacity-85 hover:opacity-100"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Field>
            <Button type="submit">Save profile</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            title="Password"
            action={
              <div className="rounded-xl bg-stone-900/5 p-2 text-muted">
                <Shield size={16} />
              </div>
            }
          />
          <form onSubmit={changePassword} className="space-y-4">
            {account?.passwordHash && (
              <Field label="Current password">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </Field>
            )}
            <Field
              label={account?.passwordHash ? "New password" : "Set password"}
            >
              <Input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="secondary">
              Update password
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            title="Alerts"
            description="In-app, browser, and email alerts for reminders, events, tickets, and meds."
          />
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/50 p-3 dark:bg-white/5">
              <div className="min-w-0">
                <div className="font-medium">Email alerts & daily brief</div>
                <p className="mt-0.5 text-xs text-muted">
                  Due alerts plus a morning summary of today’s tickets, events,
                  reminders, and medication are sent to {account?.email}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={account?.alertEmail ? "soft" : "secondary"}
                  onClick={async () => {
                    if (!account) return;
                    setNotifyMsg("");
                    const next = !Boolean(account.alertEmail);
                    const res = await fetch("/api/account", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ alertEmail: next }),
                    });
                    if (res.ok) {
                      await load();
                      setNotifyMsg(
                        next
                          ? `Email alerts enabled for ${account.email}`
                          : "Email alerts disabled"
                      );
                    } else {
                      const data = await res.json().catch(() => ({}));
                      setNotifyMsg(data.error || "Could not update email alerts");
                    }
                  }}
                >
                  {account?.alertEmail ? "Email alerts on" : "Enable email alerts"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    setNotifyMsg("Sending today’s brief…");
                    const res = await fetch("/api/notify/daily-digest", {
                      method: "POST",
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setNotifyMsg(`Today’s brief sent to ${account?.email || "your email"}`);
                    } else if (data.skipped === "empty") {
                      setNotifyMsg("Nothing is scheduled today, so no brief was sent.");
                    } else if (data.skipped === "smtp-not-configured") {
                      setNotifyMsg("Email is not configured on the server yet.");
                    } else {
                      setNotifyMsg(data.error || "Could not send today’s brief");
                    }
                  }}
                >
                  Send today’s brief
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted">
              Allow browser notifications so due items also show as toasts and
              pop-ups while Flowdesk is open (or in another tab).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="soft"
                onClick={async () => {
                  setNotifyMsg("");
                  if (!("Notification" in window)) {
                    setNotifyMsg("This browser does not support notifications");
                    return;
                  }
                  const perm = await Notification.requestPermission();
                  if (perm !== "granted") {
                    setNotifyMsg(
                      "Permission not granted — check site settings in the browser"
                    );
                    return;
                  }
                  window.dispatchEvent(
                    new CustomEvent("flowdesk:test-alert", {
                      detail: {
                        id: `enabled:${Date.now()}`,
                        kind: "reminder",
                        title: "Notifications on",
                        body: "You’ll see alerts here when something is due.",
                        href: "/today",
                      },
                    })
                  );
                  setNotifyMsg("Notifications enabled");
                }}
              >
                Enable notifications
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setNotifyMsg("");
                  window.dispatchEvent(
                    new CustomEvent("flowdesk:test-alert", {
                      detail: {
                        id: `test-inapp:${Date.now()}`,
                        kind: "event",
                        title: "Test alert",
                        body: "In-app alerts are working.",
                        href: "/account",
                      },
                    })
                  );
                  setNotifyMsg("Look at the bottom-right corner");
                }}
              >
                Test alert
              </Button>
            </div>
            {notifyMsg && (
              <p className="text-xs text-muted">{notifyMsg}</p>
            )}
          </div>
        </Panel>

        {account?.household && (
          <Panel>
            <PanelHeader title="Household" />
            <div className="mb-5 rounded-2xl border border-border/70 bg-stone-900/[0.02] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Invite code
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="font-mono text-2xl tracking-[0.2em] text-foreground">
                  {account.household.inviteCode}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={copyInvite}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={regenerateInvite}
                >
                  <RefreshCw size={14} />
                  Regenerate
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Family signs up at /signup and pastes this code to join{" "}
                <strong>{account.household.name}</strong>.
              </p>
            </div>
            <div className="space-y-2">
              {account.household.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5"
                >
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold text-white"
                    style={{ background: u.color }}
                  >
                    {(u.name || u.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {u.name || u.email}
                    </div>
                    <div className="truncate text-xs text-muted">{u.email}</div>
                  </div>
                  {u.id === account.id && <Badge tone="accent">You</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel>
          <PanelHeader title="Connected accounts" />
          <div className="space-y-3">
            {account?.accounts.length === 0 && (
              <p className="text-sm text-muted">No OAuth providers linked yet.</p>
            )}
            {account?.accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/60 px-4 py-3 dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-stone-900 text-white">
                    <Link2 size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold capitalize">
                      {a.provider}
                    </div>
                    <div className="text-xs text-muted">Connected</div>
                  </div>
                </div>
                {a.provider === "google" && (
                  <Button variant="ghost" size="sm" onClick={unlinkGoogle}>
                    Unlink
                  </Button>
                )}
              </div>
            ))}
            {googleEnabled && !hasGoogle && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => signIn("google", { callbackUrl: "/account" })}
              >
                Link Google account
              </Button>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Calendars"
            description="Sync Google calendars and todos (Tasks). Import/export ICS and JSON."
          />
          <div className="space-y-4">
            {hasGoogle && (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  Calendar access: {hasGoogleCalendar ? "on" : "missing"} · Tasks
                  access: {hasGoogleTasks ? "on" : "missing"}
                </p>
                {!hasGoogleTasks && (
                  <p className="rounded-xl border border-warm/40 bg-warm/10 px-3 py-2 text-xs text-foreground">
                    Todos cannot sync until Tasks access is granted. Unlink
                    Google, then Link Google again and accept Tasks. Link the
                    Google account that owns the todos (e.g. arnob.bnk@gmail.com
                    if that is where they live).
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={calBusy}
                    onClick={async () => {
                      setCalBusy(true);
                      setCalMsg("");
                      const res = await fetch("/api/calendar/google/calendars", {
                        method: "POST",
                      });
                      const data = await res.json();
                    setCalMsg(
                      res.ok
                        ? `Loaded ${data.imported} Google calendar(s)${
                            data.disabledStale
                              ? ` · turned off ${data.disabledStale} stale`
                              : ""
                          }`
                        : [data.error, data.hint].filter(Boolean).join(" — ")
                    );
                      await load();
                      setCalBusy(false);
                    }}
                  >
                    <RefreshCw size={14} />
                    Refresh Google list
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    disabled={calBusy}
                    onClick={async () => {
                      setCalBusy(true);
                      setCalMsg("");
                      const res = await fetch("/api/calendar/google/sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          refreshList: true,
                          tasks: true,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok && !data.ok) {
                        setCalMsg(
                          [data.error, data.hint, data.detail, data.warning]
                            .filter(Boolean)
                            .join(" — ")
                        );
                      } else if (data.tasks?.skipped && !data.upserted) {
                        setCalMsg(
                          `Events synced (${data.upserted}), but todos skipped: ${
                            data.tasks.hint || data.tasks.reason
                          }`
                        );
                      } else {
                        const failPart = data.failures?.length
                          ? ` · ${data.failures.length} calendar(s) skipped (${data.failures
                              .map((f: { calendarName?: string }) => f.calendarName)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(", ")}${data.failures.length > 2 ? "…" : ""})`
                          : "";
                        const taskPart =
                          data.tasks?.skipped
                            ? ` · todos skipped — ${data.tasks.hint || data.tasks.reason}`
                            : data.tasks?.ok
                              ? ` · ${data.tasks.upserted} todo(s) from ${data.tasks.lists} list(s)`
                              : "";
                        setCalMsg(
                          `Synced ${data.upserted} events from ${data.calendars} calendar(s)${
                            data.fromOthers
                              ? ` · ${data.fromOthers} from other people`
                              : ""
                          }${failPart}${taskPart}`
                        );
                      }
                      await load();
                      setCalBusy(false);
                    }}
                  >
                    Sync calendars & todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={calBusy}
                    onClick={async () => {
                      setCalBusy(true);
                      setCalMsg("");
                      const res = await fetch("/api/calendar/google/tasks", {
                        method: "POST",
                      });
                      const data = await res.json();
                      setCalMsg(
                        res.ok
                          ? `Synced ${data.upserted} Google todo(s) from ${data.lists} list(s)`
                          : [data.error, data.hint, data.detail]
                              .filter(Boolean)
                              .join(" — ")
                      );
                      await load();
                      setCalBusy(false);
                    }}
                  >
                    Sync Google todos
                  </Button>
                </div>
              </div>
            )}
            {hasGoogle && (
              <p className="text-xs text-muted">
                Enable Google Tasks API in Google Cloud Console if sync fails
                after re-linking.
              </p>
            )}

            {calendars.length === 0 ? (
              <p className="text-sm text-muted">
                No calendars yet. Link Google and refresh, or import an ICS/JSON file
                below.
              </p>
            ) : (
              <div className="space-y-2">
                {calendars.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white/60 px-3 py-2.5 dark:bg-white/5"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: c.color || "#0d9488" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.externalSource || "local"} · {c._count?.events ?? 0}{" "}
                        events
                      </div>
                    </div>
                    {c.externalSource === "google" && (
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={c.syncEnabled}
                          onChange={async (e) => {
                            await fetch(`/api/calendars/${c.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                syncEnabled: e.target.checked,
                              }),
                            });
                            await load();
                          }}
                        />
                        Sync
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}

            {calMsg && <p className="text-xs text-muted">{calMsg}</p>}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  window.location.href = "/api/calendar/export?format=json";
                }}
              >
                Export JSON
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  window.location.href = "/api/calendar/export?format=ics";
                }}
              >
                Export ICS
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">
                Import ICS or JSON
              </label>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm"
                placeholder="Paste .ics or Flowdesk calendar JSON…"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept=".ics,.json,text/calendar,application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImportText(await file.text());
                    }}
                  />
                  <span className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm">
                    Choose file
                  </span>
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={!importText.trim() || calBusy}
                  onClick={async () => {
                    setCalBusy(true);
                    setCalMsg("");
                    const res = await fetch("/api/calendar/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: importText }),
                    });
                    const data = await res.json();
                    setCalMsg(
                      res.ok
                        ? `Imported ${data.calendarsCreated} calendar(s), ${data.eventsCreated} event(s)`
                        : data.error || "Import failed"
                    );
                    if (res.ok) setImportText("");
                    await load();
                    setCalBusy(false);
                  }}
                >
                  Import
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Backup & data" />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              window.location.href = "/api/backup";
            }}
          >
            Download household backup
          </Button>
        </Panel>

        <Panel className="border-rose-200/80">
          <PanelHeader title="Danger zone" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={14} />
              Sign out
            </Button>
            <Button variant="danger" className="flex-1" onClick={deleteAccount}>
              <Trash2 size={14} />
              Delete account
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
