import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/session";

export const dynamic = "force-dynamic";

type DictMeaning = {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
  synonyms: string[];
};

type DictResult = {
  word: string;
  phonetic: string | null;
  lang: "en" | "bn";
  meanings: DictMeaning[];
  /** Bangla glosses / translations (when lang=bn or bilingual) */
  bangla?: { text: string; partOfSpeech?: string }[];
  englishGloss?: string | null;
};

const BN_SCRIPT = /[\u0980-\u09FF]/;

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseBanglaGlosses(raw: string): { text: string; partOfSpeech?: string }[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
  const out: { text: string; partOfSpeech?: string }[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*\(([A-Za-z.]+)\)\s*$/);
    const text = (m ? m[1] : part).trim();
    const pos = m?.[2]?.replace(/\./g, "") || undefined;
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ text, partOfSpeech: pos });
    if (out.length >= 24) break;
  }
  return out;
}

async function translateGtx(
  text: string,
  sl: string,
  tl: string
): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, 5_000);
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    // [[[translated, original, ...]]]
    const translated = (data as string[][][])?.[0]?.[0]?.[0];
    return typeof translated === "string" && translated.trim()
      ? translated.trim()
      : null;
  } catch {
    return null;
  }
}

type EnglishDictEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{
      definition?: string;
      example?: string;
      synonyms?: string[];
    }>;
    synonyms?: string[];
  }>;
  source?: "merriam-webster" | "free";
};

function cleanMwMarkup(text: string) {
  return text
    .replace(/\{bc\}/g, "")
    .replace(/\{sx\|([^|}]+)\|[^}]*\}/g, "$1")
    .replace(/\{a_link\|([^}]+)\}/g, "$1")
    .replace(/\{dxt\|([^|}]+)\|[^}]*\}/g, "$1")
    .replace(/\{wi\}|\{\/wi\}/g, "")
    .replace(/\{it\}|\{\/it\}/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMwDefinitionText(dt: unknown): string | null {
  if (!Array.isArray(dt)) return null;
  for (const chunk of dt) {
    if (!Array.isArray(chunk) || chunk[0] !== "text") continue;
    const raw = typeof chunk[1] === "string" ? chunk[1] : "";
    const cleaned = cleanMwMarkup(raw);
    if (cleaned) return cleaned;
  }
  return null;
}

function extractMwExample(dt: unknown): string | undefined {
  if (!Array.isArray(dt)) return undefined;
  for (const chunk of dt) {
    if (!Array.isArray(chunk) || chunk[0] !== "vis") continue;
    const vis = chunk[1];
    if (!Array.isArray(vis) || !vis[0] || typeof vis[0] !== "object") continue;
    const t = (vis[0] as { t?: string }).t;
    if (typeof t === "string" && t.trim()) return cleanMwMarkup(t);
  }
  return undefined;
}

async function fetchMerriamWebster(word: string): Promise<EnglishDictEntry | null> {
  const key = process.env.MERRIAM_WEBSTER_DICTIONARY_KEY?.trim();
  if (!key) return null;

  const res = await fetchWithTimeout(
    `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`,
    6_000
  );
  if (!res.ok) return null;

  const raw = (await res.json()) as unknown;
  // Suggestions when no exact match: ["word1", "word2", ...]
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (typeof raw[0] === "string") return null;

  const entries = raw as Array<{
    meta?: { id?: string; syns?: string[][] };
    hwi?: { hw?: string; prs?: { mw?: string }[] };
    fl?: string;
    shortdef?: string[];
    def?: Array<{
      sseq?: unknown[];
    }>;
  }>;

  const byPos = new Map<
    string,
    { definition: string; example?: string }[]
  >();

  for (const entry of entries.slice(0, 6)) {
    const pos = entry.fl || "—";
    const defs: { definition: string; example?: string }[] = [];

    for (const block of entry.def || []) {
      for (const sseq of block.sseq || []) {
        if (!Array.isArray(sseq)) continue;
        for (const senseWrap of sseq) {
          if (!Array.isArray(senseWrap) || senseWrap[0] !== "sense") continue;
          const sense = senseWrap[1] as { dt?: unknown } | undefined;
          const definition = extractMwDefinitionText(sense?.dt);
          if (!definition) continue;
          defs.push({
            definition,
            example: extractMwExample(sense?.dt),
          });
          if (defs.length >= 4) break;
        }
        if (defs.length >= 4) break;
      }
      if (defs.length >= 4) break;
    }

    if (defs.length === 0 && entry.shortdef?.length) {
      for (const d of entry.shortdef.slice(0, 4)) {
        if (d?.trim()) defs.push({ definition: d.trim() });
      }
    }

    if (!defs.length) continue;
    const existing = byPos.get(pos) || [];
    for (const d of defs) {
      if (existing.length >= 4) break;
      if (existing.some((x) => x.definition === d.definition)) continue;
      existing.push(d);
    }
    byPos.set(pos, existing);
  }

  if (byPos.size === 0) return null;

  const first = entries[0];
  const synonyms = [
    ...new Set(
      (first.meta?.syns || []).flat().filter((s) => typeof s === "string")
    ),
  ].slice(0, 16);

  const meanings = [...byPos.entries()].map(([partOfSpeech, definitions]) => ({
    partOfSpeech,
    definitions,
    synonyms: partOfSpeech === [...byPos.keys()][0] ? synonyms : [],
  }));

  return {
    word: first.hwi?.hw?.replace(/\*/g, "") || first.meta?.id?.split(":")[0] || word,
    phonetic: first.hwi?.prs?.find((p) => p.mw)?.mw || undefined,
    meanings,
    source: "merriam-webster",
  };
}

async function fetchFreeEnglishDict(word: string): Promise<EnglishDictEntry | null> {
  const res = await fetchWithTimeout(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    6_000
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("en_unavailable");
  const raw = (await res.json()) as EnglishDictEntry[];
  const entry = raw[0] || null;
  if (!entry) return null;
  return { ...entry, source: "free" };
}

async function fetchEnglishDict(word: string): Promise<EnglishDictEntry | null> {
  try {
    const mw = await fetchMerriamWebster(word);
    if (mw) return mw;
  } catch {
    // Fall through to free dictionary
  }
  return fetchFreeEnglishDict(word);
}

async function fetchBanglaBundle(word: string) {
  const res = await fetchWithTimeout(
    `https://dictionary.zone.id/api.php?word=${encodeURIComponent(word)}`,
    7_000
  );
  if (!res.ok) return null;
  return (await res.json()) as {
    word?: string;
    bangla_translation2?: string;
    english_pronunciation?: { phonetic?: string };
    parts_of_speech?: Array<{
      partOfSpeech?: string;
      definitions?: string[];
      examples?: string[];
    }>;
    synonyms?: string[];
  };
}

function toEnMeanings(entry: NonNullable<Awaited<ReturnType<typeof fetchEnglishDict>>>) {
  return (entry.meanings || []).map((m) => {
    const fromDefs = (m.definitions || []).flatMap((d) => d.synonyms || []);
    const syns = [...new Set([...(m.synonyms || []), ...fromDefs])].slice(0, 16);
    return {
      partOfSpeech: m.partOfSpeech || "—",
      definitions: (m.definitions || [])
        .slice(0, 4)
        .map((d) => ({
          definition: d.definition || "",
          example: d.example,
        }))
        .filter((d) => d.definition),
      synonyms: syns,
    };
  });
}

export async function GET(req: Request) {
  const auth = await requireHousehold();
  if ("error" in auth && auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get("q")?.trim() || "";
  const lang = searchParams.get("lang") === "bn" ? "bn" : "en";

  if (!rawQ || rawQ.length > 80) {
    return NextResponse.json(
      { error: "Enter a single word to look up" },
      { status: 400 }
    );
  }
  if (/\s/.test(rawQ)) {
    return NextResponse.json(
      { error: "Look up one word at a time" },
      { status: 400 }
    );
  }

  const isBanglaScript = BN_SCRIPT.test(rawQ);
  const qEn = isBanglaScript ? rawQ : rawQ.toLowerCase().replace(/[^a-z'-]/gi, "");

  if (!isBanglaScript && !qEn) {
    return NextResponse.json({ error: "Enter a valid word" }, { status: 400 });
  }

  try {
    if (lang === "en" && !isBanglaScript) {
      const entry = await fetchEnglishDict(qEn);
      if (!entry) {
        return NextResponse.json(
          { error: "No entry found", word: qEn },
          { status: 404 }
        );
      }
      const phonetic =
        entry.phonetic ||
        entry.phonetics?.find((p) => p.text)?.text ||
        null;
      const payload: DictResult = {
        word: entry.word || qEn,
        phonetic,
        lang: "en",
        meanings: toEnMeanings(entry),
      };
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "private, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    }

    // Bangla dictionary mode (or Bangla script in either mode)
    let lookupWord = isBanglaScript ? "" : qEn;
    let englishGloss: string | null = null;

    if (isBanglaScript) {
      englishGloss = await translateGtx(rawQ, "bn", "en");
      // Strip leading articles for dictionary lookup
      lookupWord = (englishGloss || "")
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[^a-z'-]/gi, "")
        .trim();
      if (!lookupWord) {
        return NextResponse.json(
          {
            word: rawQ,
            phonetic: null,
            lang: "bn",
            meanings: [],
            bangla: [{ text: rawQ }],
            englishGloss: englishGloss,
            error: englishGloss
              ? null
              : "Could not translate this Bangla word",
          },
          { status: englishGloss ? 200 : 404 }
        );
      }
    }

    const [bnBundle, enEntry] = await Promise.all([
      fetchBanglaBundle(lookupWord),
      fetchEnglishDict(lookupWord).catch(() => null),
    ]);

    const bangla = parseBanglaGlosses(bnBundle?.bangla_translation2 || "");
    // If user typed Bangla and we have no gloss list, keep the original + EN gloss
    if (isBanglaScript && bangla.length === 0) {
      bangla.push({ text: rawQ });
    }

    const meaningsFromBn = (bnBundle?.parts_of_speech || []).map((m) => ({
      partOfSpeech: m.partOfSpeech || "—",
      definitions: (m.definitions || []).slice(0, 4).map((d) => ({
        definition: d,
      })),
      synonyms: [] as string[],
    }));

    const meanings =
      meaningsFromBn.length > 0
        ? meaningsFromBn
        : enEntry
          ? toEnMeanings(enEntry)
          : [];

    if (!bangla.length && !meanings.length) {
      // Last resort: EN→BN machine translation of the English word
      const mt = await translateGtx(lookupWord, "en", "bn");
      if (mt) bangla.push({ text: mt });
    }

    if (!bangla.length && !meanings.length) {
      return NextResponse.json(
        { error: "No Bangla entry found", word: rawQ },
        { status: 404 }
      );
    }

    const phonetic =
      bnBundle?.english_pronunciation?.phonetic ||
      enEntry?.phonetic ||
      enEntry?.phonetics?.find((p) => p.text)?.text ||
      null;

    const payload: DictResult = {
      word: isBanglaScript ? rawQ : bnBundle?.word || enEntry?.word || lookupWord,
      phonetic,
      lang: "bn",
      meanings,
      bangla,
      englishGloss: isBanglaScript
        ? englishGloss || lookupWord
        : null,
    };

    // Attach English synonyms as insertable chips when useful
    if (enEntry && payload.meanings[0] && !payload.meanings[0].synonyms.length) {
      const syns = toEnMeanings(enEntry).flatMap((m) => m.synonyms).slice(0, 12);
      if (syns.length) payload.meanings[0].synonyms = syns;
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Dictionary lookup failed" }, { status: 500 });
  }
}
