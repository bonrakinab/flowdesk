"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type DictResult = {
  word: string;
  phonetic: string | null;
  lang: "en" | "bn";
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string; source?: string }[];
    synonyms: string[];
    source?: string;
  }[];
  sources?: string[];
  bangla?: { text: string; partOfSpeech?: string }[];
  englishGloss?: string | null;
};

type Lang = "en" | "bn";

type Props = {
  className?: string;
  externalWord?: string;
  externalNonce?: number;
  onInsertWord?: (word: string) => void;
};

export function PoemDictionary({
  className,
  externalWord,
  externalNonce,
  onInsertWord,
}: Props) {
  const [lang, setLang] = useState<Lang>("en");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DictResult | null>(null);

  const lookup = useCallback(
    async (word: string, which: Lang = lang) => {
      const trimmed = word.trim();
      if (!trimmed) return;
      const hasBn = /[\u0980-\u09FF]/.test(trimmed);
      const cleaned = hasBn
        ? trimmed
        : trimmed.toLowerCase().replace(/[^a-z'-]/gi, "");
      if (!cleaned) return;

      setQ(cleaned);
      setLoading(true);
      setError("");
      
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          const res = await fetch(
            `/api/dictionary?q=${encodeURIComponent(cleaned)}&lang=${which}`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          const json = await res.json();
          if (!res.ok) {
            setResult(null);
            setError(json.error || "Not found");
          } else {
            setResult(json);
          }
          break;
        } catch (err) {
          retries++;
          if (retries > maxRetries) {
            setResult(null);
            setError("Network error. Please check your connection and try again.");
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        } finally {
          if (retries > maxRetries) {
            setLoading(false);
          }
        }
      }
      setLoading(false);
    },
    [lang]
  );

  useEffect(() => {
    if (externalWord && externalNonce) void lookup(externalWord, lang);
  }, [externalWord, externalNonce, lookup, lang]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void lookup(q, lang);
  }

  function switchLang(next: Lang) {
    setLang(next);
    setResult(null);
    setError("");
    if (q.trim()) void lookup(q, next);
  }

  return (
    <aside
      className={cn(
        "poem-parchment flex h-full min-h-0 flex-col rounded-3xl border border-amber-900/15 bg-[#f3ebe0] p-4 shadow-[0_12px_40px_rgba(28,25,23,0.08)]",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-950/80">
          <BookOpen size={13} />
          Dictionary
        </div>
        <div className="flex rounded-lg bg-stone-900/10 p-0.5">
          <button
            type="button"
            onClick={() => switchLang("en")}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold transition",
              lang === "en"
                ? "bg-[#1c1917] text-[#fef3c7]"
                : "text-stone-700 hover:text-stone-900"
            )}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => switchLang("bn")}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold transition",
              lang === "bn"
                ? "bg-[#1c1917] text-[#fef3c7]"
                : "text-stone-700 hover:text-stone-900"
            )}
          >
            বাংলা
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            lang === "bn" ? "ইংরেজি বা বাংলা শব্দ…" : "Look up a word…"
          }
          className="h-10 min-w-0 flex-1 rounded-xl border border-stone-400/40 bg-[#fffaf3] px-3 text-sm outline-none ring-0"
          style={{ color: "#1c1917", WebkitTextFillColor: "#1c1917" }}
        />
        <button
          type="submit"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1c1917] text-[#fef3c7] transition hover:bg-black"
          aria-label="Search dictionary"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm text-stone-800">
        {!result && !error && !loading && (
          <p className="leading-relaxed text-stone-600">
            {lang === "bn" ? (
              <>
                বাংলা অভিধান — ইংরেজি শব্দ দিয়ে বাংলা অর্থ খুঁজুন, অথবা বাংলা
                শব্দ লিখুন। Select a word in your poem and press Ctrl/⌘+D.
              </>
            ) : (
              <>
                English meanings and synonyms — no search engine needed. Select
                a word and press Ctrl/⌘+D. Switch to বাংলা for Bangla glosses.
              </>
            )}
          </p>
        )}
        {error && <p className="text-rose-800">{error}</p>}
        {result && (
          <div className="space-y-4">
            <div>
              <div className="font-[family-name:var(--font-display)] text-2xl text-stone-900">
                {result.word}
              </div>
              {result.englishGloss && (
                <div className="mt-0.5 text-xs text-stone-600">
                  EN: {result.englishGloss}
                </div>
              )}
              {result.phonetic && (
                <div className="mt-0.5 text-xs text-stone-600">
                  {result.phonetic}
                </div>
              )}
              {result.sources && result.sources.length > 1 && (
                <div className="mt-1 text-[10px] text-stone-500">
                  Sources: {result.sources.join(", ")}
                </div>
              )}
            </div>

            {result.bangla && result.bangla.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-900">
                  বাংলা অর্থ
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.bangla.map((b) => (
                    <button
                      key={`${b.text}-${b.partOfSpeech || ""}`}
                      type="button"
                      onClick={() => onInsertWord?.(b.text)}
                      className="rounded-full border border-amber-900/20 bg-[#fffaf3] px-2.5 py-1 text-sm text-stone-900 transition hover:border-teal-800/50 hover:text-teal-950"
                      title="Insert into poem"
                    >
                      {b.text}
                      {b.partOfSpeech ? (
                        <span className="ml-1 text-[10px] text-stone-500">
                          ({b.partOfSpeech})
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {result.meanings.map((m, i) => (
              <div key={i}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-900">
                  {m.partOfSpeech}
                </div>
                <ol className="list-decimal space-y-2 pl-4 text-stone-800">
                  {m.definitions.map((d, j) => (
                    <li key={j} className="leading-relaxed">
                      {d.definition}
                      {d.source && (
                        <span className="ml-1.5 text-[10px] text-stone-500">
                          [{d.source}]
                        </span>
                      )}
                      {d.example && (
                        <div className="mt-0.5 text-xs italic text-stone-600">
                          “{d.example}”
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {m.synonyms.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.synonyms.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          if (onInsertWord) onInsertWord(s);
                          else void lookup(s, lang);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          void lookup(s, lang);
                        }}
                        className="rounded-full border border-amber-900/20 bg-[#fffaf3] px-2 py-0.5 text-[11px] text-stone-800 transition hover:border-teal-800/50 hover:text-teal-950"
                        title="Click to insert · right-click to look up"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
