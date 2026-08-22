"use client";

import Link from "next/link";
import {
  Bot,
  Focus,
  FolderKanban,
  Inbox,
  LayoutTemplate,
  List,
  Pill,
  Settings,
  Users,
  Wallet,
  Feather,
} from "lucide-react";

const links = [
  { href: "/agent", label: "Agent", icon: Bot, desc: "Chat to plan tickets, events & more" },
  { href: "/inbox", label: "Inbox", icon: Inbox, desc: "Capture & triage tasks" },
  { href: "/list", label: "List", icon: List, desc: "Dense ticket table" },
  { href: "/poems", label: "Poems", icon: Feather, desc: "Write, doodle & dictionary" },
  { href: "/meds", label: "Meds", icon: Pill, desc: "Doses & on-time alerts" },
  { href: "/finance", label: "Finance", icon: Wallet, desc: "Income, savings & tax" },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, desc: "Shopping, meals & chores" },
  { href: "/focus", label: "Focus", icon: Focus, desc: "Pomodoro timer" },
  { href: "/people", label: "People", icon: Users, desc: "Contacts & follow-ups" },
  { href: "/projects", label: "Projects", icon: FolderKanban, desc: "Life areas" },
  { href: "/account", label: "Account", icon: Settings, desc: "Profile & family invite" },
];

export default function MorePage() {
  return (
    <div className="p-4 md:p-8">
      <div className="page-canvas mx-auto max-w-lg">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">More</h1>
      <p className="text-sm text-muted mt-1">More pages</p>
      <div className="mt-6 space-y-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 hover:border-accent/40 transition"
            >
              <div className="h-10 w-10 rounded-xl bg-accent-soft text-accent grid place-items-center">
                <Icon size={18} />
              </div>
              <div>
                <div className="font-medium">{l.label}</div>
                <div className="text-xs text-muted">{l.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
      </div>
    </div>
  );
}
