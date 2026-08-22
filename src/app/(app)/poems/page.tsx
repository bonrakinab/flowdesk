"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Feather,
  PenLine,
  Plus,
  Trash2,
  Upload,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PoemDictionary } from "@/components/poems/poem-dictionary";
import { PoemDoodlePad } from "@/components/poems/poem-doodle-pad";
import { PoemImportModal } from "@/components/poems/poem-import-modal";

type PoemListItem = {
  id: string;
  title: string;
  mood: string | null;
  source: string | null;
  hasDoodle: boolean;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

type Poem = {
  id: string;
  title: string;
  body: string;
  notes: string | null;
  mood: string | null;
  source: string | null;
  doodleData: string | null;
  createdAt: string;
  updatedAt: string;
};

const MOODS = ["tender", "stormy", "playful", "quiet", "fierce"];

export default function PoemsPage() {
  const [list, setList] = useState<PoemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [poem, setPoem] = useState<Poem | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [mode, setMode] = useState<"type" | "doodle">("type");
  const [showNotes, setShowNotes] = useState(false);
  const [dictWord, setDictWord] = useState("");
  const [dictNonce, setDictNonce] = useState(0);
  const [dictOpenMobile, setDictOpenMobile] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | null>(null);
  const poemRef = useRef<Poem | null>(null);
  poemRef.current = poem;

  const loadList = useCallback(async () => {
    const res = await fetch("/api/poems");
    if (res.ok) setList(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openPoem = useCallback(async (id: string) => {
    setActiveId(id);
    const res = await fetch(`/api/poems/${id}`);
    if (res.ok) {
      const data = (await res.json()) as Poem;
      setPoem(data);
      setMode(data.doodleData && !data.body.trim() ? "doodle" : "type");
      setShowNotes(Boolean(data.notes));
    }
  }, []);

  const scheduleSave = useCallback(
    (patch: Partial<Poem>) => {
      setPoem((prev) => (prev ? { ...prev, ...patch } : prev));
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const current = poemRef.current;
        if (!current) return;
        setSaving(true);
        await fetch(`/api/poems/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: current.title,
            body: current.body,
            notes: current.notes,
            mood: current.mood,
            source: current.source,
            doodleData: current.doodleData,
          }),
        });
        setSaving(false);
        void loadList();
      }, 800);
    },
    [loadList]
  );

  async function createBlank() {
    const res = await fetch("/api/poems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled", body: "", source: null }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as Poem;
    await loadList();
    setPoem(created);
    setActiveId(created.id);
    setMode("type");
    window.setTimeout(() => titleRef.current?.focus(), 50);
  }

  async function removePoem(id: string) {
    if (!confirm("Delete this poem?")) return;
    await fetch(`/api/poems/${id}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId(null);
      setPoem(null);
    }
    await loadList();
  }

  function insertWord(word: string) {
    if (!poem) return;
    const el = bodyRef.current;
    if (!el) {
      scheduleSave({
        body: `${poem.body}${poem.body ? " " : ""}${word}`,
      });
      setMode("type");
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = poem.body.slice(0, start) + word + poem.body.slice(end);
    scheduleSave({ body: next });
    setMode("type");
    window.setTimeout(() => {
      el.focus();
      const pos = start + word.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "d") return;
      const sel = window.getSelection()?.toString().trim();
      const fromTextarea =
        bodyRef.current &&
        document.activeElement === bodyRef.current
          ? bodyRef.current.value
              .slice(bodyRef.current.selectionStart, bodyRef.current.selectionEnd)
              .trim()
          : "";
      const word = (fromTextarea || sel || "").split(/\s+/)[0];
      if (!word) return;
      e.preventDefault();
      setDictWord(word);
      setDictNonce((n) => n + 1);
      setDictOpenMobile(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(() => {
    if (!poem) return { words: 0, lines: 0 };
    const lines = poem.body ? poem.body.split(/\r?\n/).length : 0;
    const words = poem.body.trim()
      ? poem.body.trim().split(/\s+/).filter(Boolean).length
      : 0;
    return { words, lines };
  }, [poem]);

  return (
    <div className="poem-atelier relative min-h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(212,175,120,0.35),transparent_50%),radial-gradient(ellipse_at_90%_10%,rgba(94,120,140,0.22),transparent_45%),linear-gradient(165deg,#1a2332_0%,#2c2430_40%,#3d2e28_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="page-canvas relative mx-auto max-w-6xl px-4 py-8 md:px-8">
        {!poem ? (
          <div>
            <header className="mb-8 max-w-xl">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/70">
                <Feather size={13} />
                Atelier
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-amber-50 md:text-5xl">
                Poems
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/65">
                A quiet place to write, doodle, look up words, and keep verses
                from OneNote and elsewhere.
              </p>
            </header>

            <div className="mb-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void createBlank()}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold poem-chip-on shadow-sm transition hover:bg-amber-50"
              >
                <Plus size={16} />
                New poem
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-100/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-white/15"
              >
                <Upload size={16} />
                Import
              </button>
            </div>

            {loading ? (
              <div className="h-40 animate-pulse rounded-3xl bg-white/5" />
            ) : list.length === 0 ? (
              <div className="rounded-3xl border border-amber-100/15 bg-black/20 px-6 py-14 text-center backdrop-blur-sm">
                <PenLine className="mx-auto mb-3 text-amber-100/50" size={28} />
                <p className="text-amber-50/80">No poems yet.</p>
                <p className="mt-1 text-sm text-amber-100/50">
                  Write one, doodle one, or import from OneNote.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openPoem(item.id)}
                      className="poem-parchment group w-full rounded-3xl border border-amber-100/12 bg-[#f7f1e6] p-5 text-left shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-amber-200/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-[family-name:var(--font-display)] text-xl text-stone-900">
                          {item.title}
                        </h2>
                        <div className="flex shrink-0 gap-1">
                          {item.hasDoodle && (
                            <span className="rounded-full bg-stone-900/10 px-2 py-0.5 text-[10px] font-medium text-stone-700">
                              doodle
                            </span>
                          )}
                          {item.source && (
                            <span className="rounded-full bg-teal-900/10 px-2 py-0.5 text-[10px] font-medium text-teal-900">
                              {item.source}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.preview && (
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                          {item.preview}
                        </p>
                      )}
                      <div className="poem-ink-muted mt-3 text-[11px]">
                        Updated{" "}
                        {formatDistanceToNow(parseISO(item.updatedAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPoem(null);
                    setActiveId(null);
                    void loadList();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-amber-100/80 transition hover:bg-white/10 hover:text-amber-50"
                >
                  <ArrowLeft size={16} />
                  Library
                </button>
                <span className="text-xs text-amber-100/45">
                  {saving ? "Saving…" : "Saved"}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <div className="flex rounded-xl bg-black/40 p-1">
                    <button
                      type="button"
                      onClick={() => setMode("type")}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        mode === "type"
                          ? "poem-chip-on"
                          : "text-amber-50 hover:bg-white/10"
                      )}
                    >
                      Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("doodle")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        mode === "doodle"
                          ? "poem-chip-on"
                          : "text-amber-50 hover:bg-white/10"
                      )}
                    >
                      <Pencil size={12} />
                      Doodle
                    </button>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-amber-50 lg:hidden"
                    onClick={() => setDictOpenMobile((v) => !v)}
                  >
                    Dictionary
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePoem(poem.id)}
                    className="rounded-lg p-1.5 text-amber-100/50 transition hover:bg-rose-500/20 hover:text-rose-200"
                    aria-label="Delete poem"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="poem-parchment rounded-[1.75rem] border border-amber-900/10 bg-[#f7f1e6] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:p-8">
                <input
                  ref={titleRef}
                  value={poem.title}
                  onChange={(e) => scheduleSave({ title: e.target.value })}
                  className="w-full border-0 bg-transparent font-[family-name:var(--font-display)] text-3xl outline-none md:text-4xl"
                  style={{ color: "#1c1917", WebkitTextFillColor: "#1c1917" }}
                  placeholder="Title"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        scheduleSave({ mood: poem.mood === m ? null : m })
                      }
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize transition",
                        poem.mood === m
                          ? "bg-[#1c1917] text-[#fef3c7]"
                          : "bg-[#e7e5e4] text-[#1c1917] hover:bg-[#d6d3d1]"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                  <span
                    className="ml-auto text-[11px] font-medium"
                    style={{ color: "#44403c" }}
                  >
                    {stats.lines} lines · {stats.words} words
                  </span>
                </div>

                {mode === "type" ? (
                  <textarea
                    ref={bodyRef}
                    value={poem.body}
                    onChange={(e) => scheduleSave({ body: e.target.value })}
                    rows={16}
                    spellCheck
                    placeholder="Write your poem…"
                    className="mt-5 w-full resize-y border-0 bg-transparent font-[family-name:var(--font-display)] text-lg leading-[1.85] outline-none"
                    style={{ color: "#1c1917", WebkitTextFillColor: "#1c1917" }}
                  />
                ) : (
                  <div className="mt-5">
                    <PoemDoodlePad
                      value={poem.doodleData}
                      onChange={(dataUrl) =>
                        scheduleSave({ doodleData: dataUrl })
                      }
                    />
                  </div>
                )}

                <div className="mt-4 border-t border-stone-900/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowNotes((v) => !v)}
                    className="text-xs font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "#44403c" }}
                  >
                    {showNotes ? "Hide" : "Show"} scratch notes / word bank
                  </button>
                  {showNotes && (
                    <textarea
                      value={poem.notes || ""}
                      onChange={(e) => scheduleSave({ notes: e.target.value })}
                      rows={4}
                      placeholder="Loose words, images, rhymes…"
                      className="mt-2 w-full rounded-xl border border-stone-900/10 bg-[#fffaf3] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-800/20"
                      style={{ color: "#1c1917", WebkitTextFillColor: "#1c1917" }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div
              className={cn(
                "lg:sticky lg:top-6 lg:h-[min(70vh,640px)]",
                dictOpenMobile ? "block" : "hidden lg:block"
              )}
            >
              <PoemDictionary
                className="h-full"
                externalWord={dictWord}
                externalNonce={dictNonce}
                onInsertWord={insertWord}
              />
            </div>
          </div>
        )}
      </div>

      <PoemImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={async (poems) => {
          const res = await fetch("/api/poems", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ poems }),
          });
          if (!res.ok) throw new Error("import failed");
          await loadList();
        }}
      />
    </div>
  );
}
