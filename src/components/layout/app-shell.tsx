"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Focus,
  Inbox,
  LayoutGrid,
  List,
  MoreHorizontal,
  NotebookPen,
  Settings,
  SunMedium,
  Users,
  FolderKanban,
  Wallet,
  LayoutTemplate,
  Pill,
  Feather,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { FloatingTimer } from "@/components/pomodoro/floating-timer";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ReminderWatcher } from "@/components/reminders/reminder-watcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PageBackdrop } from "@/components/theme/page-backdrop";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { MadeWithLoveFooter } from "@/components/layout/made-with-love-footer";

const primary = [
  { href: "/today", label: "Today", icon: SunMedium },
  { href: "/board", label: "Board", icon: LayoutGrid },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

const more = [
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/list", label: "List", icon: List },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/poems", label: "Poems", icon: Feather },
  { href: "/meds", label: "Meds", icon: Pill },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/focus", label: "Focus", icon: Focus },
  { href: "/people", label: "People", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/account", label: "Account", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useSession();

  return (
    <div className="min-h-screen md:flex">
      <aside className="relative z-30 hidden md:flex w-60 shrink-0 flex-col bg-rail text-rail-fg">
        <div className="px-5 pt-6 pb-4">
          <Link href="/today" className="block">
            <div className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-tight">
              Flowdesk
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-stone-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-4 pb-2 px-3 text-[10px] uppercase tracking-widest text-stone-500">
            More
          </div>
          {more.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-stone-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-stone-500">
              Theme
            </span>
            <ThemeToggle compact />
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full grid place-items-center text-sm font-semibold text-white"
              style={{ background: data?.user?.color || "#0d9488" }}
            >
              {(data?.user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {data?.user?.name || "You"}
              </div>
              <div className="truncate text-xs text-stone-400">
                {data?.user?.email}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-stone-500">
            Press <kbd className="rounded bg-white/10 px-1">⌘K</kbd> for commands
          </div>
        </div>
      </aside>

      <div className="relative z-10 flex-1 min-w-0 pb-20 md:pb-0">
        <header className="md:hidden sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Flowdesk
            </div>
            <div className="font-[family-name:var(--font-display)] text-lg leading-none">
              {primary.concat(more).find((i) => pathname.startsWith(i.href))?.label ||
                "Home"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link
              href="/account"
              className="h-9 w-9 rounded-full grid place-items-center text-white text-sm"
              style={{ background: data?.user?.color || "#0d9488" }}
            >
              {(data?.user?.name || "U").slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <PageBackdrop>
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <MadeWithLoveFooter />
        </PageBackdrop>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="grid grid-cols-5 gap-1 px-1 py-1.5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px]",
                  active ? "text-accent" : "text-muted"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/more"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px]",
              pathname.startsWith("/more") ||
                pathname.startsWith("/agent") ||
                pathname.startsWith("/inbox") ||
                pathname.startsWith("/poems") ||
                pathname.startsWith("/list") ||
                pathname.startsWith("/people") ||
                pathname.startsWith("/projects") ||
                pathname.startsWith("/finance") ||
                pathname.startsWith("/templates") ||
                pathname.startsWith("/meds") ||
                pathname.startsWith("/focus") ||
                pathname.startsWith("/account")
                ? "text-accent"
                : "text-muted"
            )}
          >
            <MoreHorizontal size={18} />
            More
          </Link>
        </div>
      </nav>

      <OfflineBanner />
      <FloatingTimer />
      <CommandPalette />
      <ReminderWatcher />
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <PageBackdrop className="min-h-screen">
      <div className="atmosphere relative grid min-h-screen place-items-center px-4 py-10">
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle compact />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
              Flowdesk
            </h1>
          </div>
          <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-[var(--shadow)] backdrop-blur-md">
            {children}
          </div>
        </div>
      </div>
    </PageBackdrop>
  );
}
