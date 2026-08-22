"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, SendHorizontal, Sparkles } from "lucide-react";
import type { AgentProposal } from "@/lib/agent/types";
import { ConfirmBar, ProposalCard } from "./proposal-card";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  links?: { href: string; label: string }[];
};

const EXAMPLES = [
  "What's due today?",
  "Dentist for Sam on September 15 2026 at 3pm, remind me 1 hour before",
  "Ticket: renew passport by March 2027",
  "Add med Vitamin D at 09:00 and 21:00",
];

export function AgentChat() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — I'm your Flowdesk Agent. Ask what's due, or describe tickets, events, meds, notes, or poems. I'll preview writes for you to confirm.",
    },
  ]);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agent/chat")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposals]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    const userMsg: Msg = {
      id: `u_${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_GEMINI_KEY") setConfigured(false);
        setMessages((m) => [
          ...m,
          {
            id: `e_${Date.now()}`,
            role: "system",
            content: data.error || "Request failed",
          },
        ]);
        return;
      }
      setConfigured(true);
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.reply || "…",
        },
      ]);
      if (Array.isArray(data.proposals) && data.proposals.length) {
        setProposals((prev) => [...prev, ...data.proposals]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: "system",
          content: "Network error talking to the agent.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAll() {
    if (!proposals.length || executing) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposals }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            id: `e_${Date.now()}`,
            role: "system",
            content: data.error || "Could not save",
          },
        ]);
        return;
      }
      const results = (data.results || []) as {
        ok: boolean;
        href?: string;
        kind: string;
        error?: string;
        id?: string;
      }[];
      const ok = results.filter((r) => r.ok);
      const fail = results.filter((r) => !r.ok);
      const links = ok
        .filter((r) => r.href)
        .map((r) => ({
          href: r.href!,
          label: r.kind.replace(/_/g, " "),
        }));
      setMessages((m) => [
        ...m,
        {
          id: `ok_${Date.now()}`,
          role: "assistant",
          content:
            fail.length === 0
              ? `Saved ${ok.length} item${ok.length === 1 ? "" : "s"}.`
              : `Saved ${ok.length}, failed ${fail.length}: ${fail
                  .map((f) => f.error || "error")
                  .join("; ")}`,
          links,
        },
      ]);
      setProposals([]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: "system",
          content: "Network error while confirming.",
        },
      ]);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col gap-4">
      <header className="flex items-start gap-3">
        <div className="mt-1 grid h-10 w-10 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Bot size={20} />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Agent
          </h1>
          <p className="mt-1 text-sm text-muted">
            Natural language for your household CRM — confirm before anything is
            written.
          </p>
        </div>
      </header>

      {configured === false && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">Gemini is not configured</p>
          <p className="mt-1 text-muted">
            Set <code className="text-xs">GEMINI_API_KEY</code> in Vercel (or
            local <code className="text-xs">.env</code>) from{" "}
            <a
              className="underline"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio
            </a>
            . Meanwhile use Today&apos;s smart composer for simple captures.
          </p>
          <Link href="/today" className="mt-2 inline-block text-accent underline">
            Open Today
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={busy || configured === false}
            onClick={() => send(ex)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
          >
            <Sparkles size={12} />
            {ex}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 rounded-3xl border border-border bg-card/60 p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-8 rounded-2xl bg-accent/15 px-3 py-2 text-sm"
                : m.role === "system"
                  ? "rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm"
                  : "mr-8 rounded-2xl bg-background/80 px-3 py-2 text-sm"
            }
          >
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.links && m.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.links.map((l, i) => (
                  <Link
                    key={`${l.href}-${i}`}
                    href={l.href}
                    className="rounded-lg bg-accent/15 px-2 py-1 text-xs text-accent"
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-8 text-xs text-muted animate-pulse">Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>

      {proposals.length > 0 && (
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              disabled={executing}
              onChange={(next) =>
                setProposals((list) =>
                  list.map((x) => (x.id === next.id ? next : x))
                )
              }
              onRemove={() =>
                setProposals((list) => list.filter((x) => x.id !== p.id))
              }
            />
          ))}
          <ConfirmBar
            count={proposals.length}
            loading={executing}
            onConfirm={confirmAll}
            onClear={() => setProposals([])}
          />
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || configured === false}
          placeholder="Ask or describe what to create…"
          className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || configured === false}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white disabled:opacity-50"
          aria-label="Send"
        >
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}
