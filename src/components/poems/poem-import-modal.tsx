"use client";

import { FormEvent, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { Button, Input, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type PoemDraft = {
  title: string;
  body: string;
  source: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (poems: PoemDraft[]) => Promise<void>;
};

function splitBulk(text: string): string[] {
  const parts = text
    .split(/\n\s*---\s*\n|\n{3,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : text.trim() ? [text.trim()] : [];
}

function titleFromBody(body: string, fallback: string) {
  const first = body.split(/\r?\n/).find((l) => l.trim());
  if (!first) return fallback;
  return first.replace(/^#+\s*/, "").slice(0, 80);
}

export function PoemImportModal({ open, onClose, onImport }: Props) {
  const [tab, setTab] = useState<"paste" | "files">("paste");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState("OneNote");
  const [bulk, setBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function submitPaste(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setError("Paste a poem first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const chunks = bulk ? splitBulk(body) : [body.trim()];
      const poems = chunks.map((chunk, i) => ({
        title:
          !bulk && title.trim()
            ? title.trim()
            : titleFromBody(chunk, `Imported ${i + 1}`),
        body: chunk,
        source: source.trim() || "Import",
      }));
      await onImport(poems);
      setTitle("");
      setBody("");
      onClose();
    } catch {
      setError("Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const poems: PoemDraft[] = [];
      for (const file of Array.from(files)) {
        if (!/\.(txt|md|text)$/i.test(file.name) && file.type && !file.type.startsWith("text/")) {
          continue;
        }
        const text = await file.text();
        const name = file.name.replace(/\.(txt|md|text)$/i, "");
        poems.push({
          title: name || titleFromBody(text, "Imported"),
          body: text,
          source: source.trim() || "Import",
        });
      }
      if (!poems.length) {
        setError("No text files found (.txt or .md)");
        return;
      }
      await onImport(poems);
      onClose();
    } catch {
      setError("Could not read files");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/50 p-4 backdrop-blur-sm">
      <div className="poem-parchment w-full max-w-lg rounded-3xl border border-amber-900/20 bg-[#f7f1e6] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-stone-900">
              Import poems
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Paste from OneNote or upload .txt / .md files.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-900/5 hover:text-stone-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-stone-900/5 p-1">
          {(
            [
              ["paste", "Paste"],
              ["files", "Files"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition",
                tab === id
                  ? "bg-[#fffaf3] text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <Label className="text-stone-700">Source</Label>
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="OneNote, Phone, Notebook…"
            className="mt-1 border-amber-900/15 bg-[#fffaf3]"
          />
        </div>

        {tab === "paste" ? (
          <form onSubmit={submitPaste} className="space-y-3">
            <div>
              <Label className="text-stone-700">Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={bulk}
                placeholder="Leave blank to use first line"
                className="mt-1 border-amber-900/15 bg-[#fffaf3]"
              />
            </div>
            <div>
              <Label className="text-stone-700">Poem text</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Paste your poem here…"
                className="mt-1 w-full rounded-xl border border-amber-900/15 bg-[#fffaf3] px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-teal-700/30"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={bulk}
                onChange={(e) => setBulk(e.target.checked)}
              />
              Split into multiple poems (blank lines or ---)
            </label>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.text,text/plain,text/markdown"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-amber-900/25 bg-[#fffaf3] px-4 py-10 text-stone-600 transition hover:border-teal-700/40 hover:text-teal-900"
            >
              <FileUp size={22} />
              <span className="text-sm font-medium">
                {busy ? "Importing…" : "Choose .txt or .md files"}
              </span>
            </button>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
