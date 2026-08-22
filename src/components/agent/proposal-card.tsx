"use client";

import { useMemo, useState } from "react";
import type { AgentProposal, ProposalKind } from "@/lib/agent/types";

const KIND_LABEL: Record<ProposalKind, string> = {
  create_ticket: "Ticket",
  create_event: "Event",
  create_reminder: "Reminder",
  create_med: "Medication",
  create_note: "Note",
  create_poem: "Poem",
  update_ticket: "Update ticket",
};

function fieldKeys(kind: ProposalKind): string[] {
  switch (kind) {
    case "create_ticket":
      return ["title", "description", "priority", "dueAt", "isInbox", "isFocus"];
    case "create_event":
      return [
        "title",
        "description",
        "startAt",
        "endAt",
        "allDay",
        "remindMinutesBefore",
      ];
    case "create_reminder":
      return ["title", "remindAt"];
    case "create_med":
      return ["name", "dosage", "note", "times", "remindMinutesBefore"];
    case "create_note":
      return ["title", "content", "mood", "pinned"];
    case "create_poem":
      return ["title", "body", "notes", "mood"];
    case "update_ticket":
      return ["id", "title", "status", "priority", "dueAt", "isFocus", "isInbox"];
  }
}

export function ProposalCard({
  proposal,
  onChange,
  onRemove,
  disabled,
}: {
  proposal: AgentProposal;
  onChange: (next: AgentProposal) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const keys = useMemo(() => fieldKeys(proposal.kind), [proposal.kind]);

  function setField(key: string, raw: string) {
    const payload = { ...proposal.payload };
    if (key === "times") {
      payload.times = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (key === "allDay" || key === "pinned" || key === "isInbox" || key === "isFocus") {
      payload[key] = raw === "true" || raw === "1" || raw.toLowerCase() === "yes";
    } else if (key === "remindMinutesBefore") {
      const n = Number(raw);
      payload[key] = Number.isFinite(n) ? n : null;
    } else {
      payload[key] = raw;
    }
    onChange({
      ...proposal,
      payload,
      summary: `${KIND_LABEL[proposal.kind]}: ${String(
        payload.title || payload.name || proposal.summary
      )}`,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">
            {KIND_LABEL[proposal.kind]}
          </div>
          <div className="mt-0.5 text-sm font-medium">{proposal.summary}</div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="text-xs text-muted hover:text-foreground"
        >
          Remove
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {keys.map((key) => {
          const val = proposal.payload[key];
          const display =
            key === "times" && Array.isArray(val)
              ? val.join(", ")
              : val == null
                ? ""
                : String(val);
          const multiline = key === "description" || key === "content" || key === "body" || key === "notes";
          return (
            <label key={key} className="block">
              <span className="text-[11px] text-muted">{key}</span>
              {multiline ? (
                <textarea
                  disabled={disabled}
                  value={display}
                  onChange={(e) => setField(key, e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              ) : (
                <input
                  disabled={disabled || key === "id"}
                  value={display}
                  onChange={(e) => setField(key, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ConfirmBar({
  count,
  loading,
  onConfirm,
  onClear,
}: {
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;
  return (
    <div className="sticky bottom-20 md:bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="text-sm">
        <span className="font-medium">{count}</span> action
        {count === 1 ? "" : "s"} ready — nothing is saved until you confirm.
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || busy}
          onClick={onClear}
          className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-muted/30"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={loading || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading || busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
