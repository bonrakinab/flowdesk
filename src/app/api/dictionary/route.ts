import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/session";

export const dynamic = "force-dynamic";

type DictMeaning = {
  partOfSpeech: string;
  definitions: { definition: string; example?: string; source?: string }[];
  synonyms: string[];
  source?: string;
};

type DictResult = {
  word: string;
  phonetic: string | null;
  lang: "en" | "bn";
  meanings: DictMeaning[];
  sources?: string[];
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
    const res = await fetchWithTimeout(url, 8_000);
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

async function fetchEnglishDict(word: string) {
  const res = await fetchWithTimeout(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    10_000
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("en_unavailable");
  const raw = (await res.json()) as Array<{
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
    sourceUrls?: string[];
  }>;
  return raw[0] || null;
}

async function fetchMerriamWebster(word: string) {
  const apiKey = process.env.MERRIAM_WEBSTER_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetchWithTimeout(
      `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${apiKey}`,
      10_000
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    
    const raw = (await res.json()) as Array<{
      meta?: { id?: string };
      hwi?: { hw?: string; prs?: Array<{ mw?: string }> };
      fl?: string;
      shortdef?: string[];
      def?: Array<{
        sseq?: Array<Array<Array<string | { dt?: Array<[string, string]> }>>>;
      }>;
    }>;
    
    if (!raw || raw.length === 0 || typeof raw[0] === 'string') return null;
    
    return raw;
  } catch {
    return null;
  }
}

async function fetchWordnik(word: string) {
  const apiKey = process.env.WORDNIK_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetchWithTimeout(
      `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/definitions?limit=10&includeRelated=false&useCanonical=true&includeTags=false&api_key=${apiKey}`,
      10_000
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    
    const raw = (await res.json()) as Array<{
      word?: string;
      partOfSpeech?: string;
      text?: string;
      attributionText?: string;
    }>;
    
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

async function fetchBanglaBundle(word: string) {
  const res = await fetchWithTimeout(
    `https://dictionary.zone.id/api.php?word=${encodeURIComponent(word)}`,
    10_000
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

function toEnMeanings(entry: NonNullable<Awaited<ReturnType<typeof fetchEnglishDict>>>, source = "Free Dictionary") {
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
          source,
        }))
        .filter((d) => d.definition),
      synonyms: syns,
      source,
    };
  });
}

function parseMerriamWebster(entries: NonNullable<Awaited<ReturnType<typeof fetchMerriamWebster>>>) {
  const meanings: DictMeaning[] = [];
  
  for (const entry of entries.slice(0, 3)) {
    if (!entry.fl) continue;
    
    const definitions: { definition: string; example?: string; source?: string }[] = [];
    
    if (entry.shortdef) {
      definitions.push(
        ...entry.shortdef.slice(0, 3).map((def) => ({
          definition: def,
          source: "Merriam-Webster",
        }))
      );
    }
    
    if (definitions.length > 0) {
      meanings.push({
        partOfSpeech: entry.fl,
        definitions,
        synonyms: [],
        source: "Merriam-Webster",
      });
    }
  }
  
  return meanings;
}

function parseWordnik(entries: NonNullable<Awaited<ReturnType<typeof fetchWordnik>>>) {
  const grouped = new Map<string, typeof entries>();
  
  for (const entry of entries) {
    const pos = entry.partOfSpeech || "—";
    if (!grouped.has(pos)) grouped.set(pos, []);
    grouped.get(pos)!.push(entry);
  }
  
  const meanings: DictMeaning[] = [];
  
  for (const [pos, defs] of grouped.entries()) {
    meanings.push({
      partOfSpeech: pos,
      definitions: defs.slice(0, 3).map((d) => ({
        definition: d.text || "",
        source: d.attributionText || "Wordnik",
      })),
      synonyms: [],
      source: "Wordnik",
    });
  }
  
  return meanings;
}

function mergeMeanings(meaningsList: DictMeaning[][]) {
  const merged: DictMeaning[] = [];
  const posMap = new Map<string, DictMeaning>();
  
  for (const meanings of meaningsList) {
    for (const meaning of meanings) {
      const pos = meaning.partOfSpeech;
      
      if (!posMap.has(pos)) {
        posMap.set(pos, {
          partOfSpeech: pos,
          definitions: [],
          synonyms: [],
        });
      }
      
      const existing = posMap.get(pos)!;
      
      for (const def of meaning.definitions) {
        const isDuplicate = existing.definitions.some(
          (d) => d.definition.toLowerCase() === def.definition.toLowerCase()
        );
        if (!isDuplicate) {
          existing.definitions.push(def);
        }
      }
      
      for (const syn of meaning.synonyms) {
        if (!existing.synonyms.includes(syn)) {
          existing.synonyms.push(syn);
        }
      }
    }
  }
  
  merged.push(...posMap.values());
  
  for (const meaning of merged) {
    meaning.definitions = meaning.definitions.slice(0, 8);
    meaning.synonyms = meaning.synonyms.slice(0, 16);
  }
  
  return merged;
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
      const [entry, mwEntries, wordnikEntries] = await Promise.all([
        fetchEnglishDict(qEn),
        fetchMerriamWebster(qEn).catch(() => null),
        fetchWordnik(qEn).catch(() => null),
      ]);
      
      const allMeanings: DictMeaning[][] = [];
      const sources: string[] = [];
      
      if (entry) {
        allMeanings.push(toEnMeanings(entry, "Free Dictionary"));
        sources.push("Free Dictionary");
      }
      
      if (mwEntries) {
        const mwMeanings = parseMerriamWebster(mwEntries);
        if (mwMeanings.length > 0) {
          allMeanings.push(mwMeanings);
          sources.push("Merriam-Webster");
        }
      }
      
      if (wordnikEntries) {
        const wordnikMeanings = parseWordnik(wordnikEntries);
        if (wordnikMeanings.length > 0) {
          allMeanings.push(wordnikMeanings);
          sources.push("Wordnik");
        }
      }
      
      if (allMeanings.length === 0) {
        return NextResponse.json(
          { error: "No entry found", word: qEn },
          { status: 404 }
        );
      }
      
      const meanings = mergeMeanings(allMeanings);
      
      const phonetic =
        entry?.phonetic ||
        entry?.phonetics?.find((p) => p.text)?.text ||
        null;
        
      const payload: DictResult = {
        word: entry?.word || qEn,
        phonetic,
        lang: "en",
        meanings,
        sources: sources.length > 1 ? sources : undefined,
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
  } catch (err) {
    console.error("Dictionary lookup error:", err);
    return NextResponse.json(
      { error: "Dictionary lookup failed. Please check your connection and try again." },
      { status: 500 }
    );
  }
}
