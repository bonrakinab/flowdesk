"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemePalette =
  | "default"
  | "glass"
  | "ocean"
  | "ember"
  | "slate";
export type WallpaperMode = "off" | "live" | "static";

export type WallpaperInfo = {
  url: string;
  title: string;
  copyright: string;
  startDate: string;
  idx: number;
};

type StoredWallpaper = WallpaperInfo & {
  fetchedAt?: number;
  day?: string;
  mode?: WallpaperMode;
  pinnedAt?: number;
};

const LIVE_CACHE_KEY = "flowdesk-wallpaper-cache";
const PINNED_KEY = "flowdesk-wallpaper-pinned";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export const THEME_PALETTES: {
  id: ThemePalette;
  label: string;
  blurb: string;
}[] = [
  { id: "default", label: "Default", blurb: "Warm stone & teal" },
  { id: "glass", label: "Glass", blurb: "Frosted translucent panels" },
  { id: "ocean", label: "Ocean", blurb: "Cool slate & cyan" },
  { id: "ember", label: "Ember", blurb: "Warm amber glow" },
  { id: "slate", label: "Slate", blurb: "Neutral graphite" },
];

type ThemeContextValue = {
  theme: ThemeMode;
  resolved: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  wallpaperMode: WallpaperMode;
  setWallpaperMode: (mode: WallpaperMode) => void;
  wallpaperIdx: number;
  setWallpaperIdx: (idx: number) => void;
  wallpaper: WallpaperInfo | null;
  wallpaperLoading: boolean;
  refreshWallpaper: (opts?: { force?: boolean }) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PALETTE_IDS = new Set<ThemePalette>([
  "default",
  "glass",
  "ocean",
  "ember",
  "slate",
]);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Local calendar day as Bing-style YYYYMMDD */
function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function applyMode(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function applyPalette(palette: ThemePalette) {
  document.documentElement.dataset.palette = palette;
}

function themeColorFor(resolved: "light" | "dark", palette: ThemePalette) {
  if (resolved === "dark") {
    if (palette === "ocean") return "#0b1220";
    if (palette === "ember") return "#1a100c";
    if (palette === "slate") return "#0f1115";
    if (palette === "glass") return "#10141c";
    return "#0c0a09";
  }
  if (palette === "ocean") return "#0e7490";
  if (palette === "ember") return "#c2410c";
  if (palette === "slate") return "#475569";
  if (palette === "glass") return "#0f766e";
  return "#0d9488";
}

function applyThemeColor(resolved: "light" | "dark", palette: ThemePalette) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeColorFor(resolved, palette));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [palette, setPaletteState] = useState<ThemePalette>("default");
  const [wallpaperMode, setWallpaperModeState] =
    useState<WallpaperMode>("static");
  const [wallpaperIdx, setWallpaperIdxState] = useState(0);
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(null);
  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("flowdesk-theme") as ThemeMode | null;
    const initial =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    const next = initial === "system" ? getSystemTheme() : initial;

    const storedPalette = localStorage.getItem(
      "flowdesk-palette"
    ) as ThemePalette | null;
    const nextPalette =
      storedPalette && PALETTE_IDS.has(storedPalette)
        ? storedPalette
        : "default";

    const storedWp = localStorage.getItem(
      "flowdesk-wallpaper-mode"
    ) as WallpaperMode | null;
    // Default to static so page gutters always have a stable photo fill.
    const nextWp =
      storedWp === "live" || storedWp === "static" || storedWp === "off"
        ? storedWp
        : "static";

    const storedIdx = Number(localStorage.getItem("flowdesk-wallpaper-idx") || "0");
    const nextIdx =
      Number.isFinite(storedIdx) && storedIdx >= 0 && storedIdx <= 7
        ? Math.floor(storedIdx)
        : 0;

    setThemeState(initial);
    setResolved(next);
    setPaletteState(nextPalette);
    setWallpaperModeState(nextWp);
    setWallpaperIdxState(nextIdx);
    applyMode(next);
    applyPalette(nextPalette);
    applyThemeColor(next, nextPalette);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = theme === "system" ? getSystemTheme() : theme;
    setResolved(next);
    applyMode(next);
    applyThemeColor(next, palette);
    localStorage.setItem("flowdesk-theme", theme);

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const sys = getSystemTheme();
      setResolved(sys);
      applyMode(sys);
      applyThemeColor(sys, palette);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, palette, ready]);

  useEffect(() => {
    if (!ready) return;
    applyPalette(palette);
    applyThemeColor(resolved, palette);
    localStorage.setItem("flowdesk-palette", palette);
  }, [palette, resolved, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("flowdesk-wallpaper-mode", wallpaperMode);
    localStorage.setItem("flowdesk-wallpaper-idx", String(wallpaperIdx));
  }, [wallpaperMode, wallpaperIdx, ready]);

  const refreshWallpaper = useCallback(
    async (opts?: { force?: boolean }) => {
      if (wallpaperMode === "off") {
        setWallpaper(null);
        return;
      }

      // Static: keep the pinned photo forever unless the user picks another day or Refresh
      if (wallpaperMode === "static" && !opts?.force) {
        const pinned = readJson<StoredWallpaper>(PINNED_KEY);
        if (pinned?.url && pinned.idx === wallpaperIdx) {
          setWallpaper(pinned);
          return;
        }
      }

      const idx = wallpaperMode === "static" ? wallpaperIdx : 0;
      const today = localYmd();
      setWallpaperLoading(true);
      try {
        const qs = new URLSearchParams({ idx: String(idx) });
        if (wallpaperMode === "live") {
          qs.set("fresh", "1");
          qs.set("day", today);
        }
        const res = await fetch(`/api/wallpaper?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Wallpaper unavailable");
        const data = (await res.json()) as WallpaperInfo;
        setWallpaper(data);

        if (wallpaperMode === "static") {
          writeJson(PINNED_KEY, {
            ...data,
            mode: "static",
            pinnedAt: Date.now(),
          });
        } else {
          writeJson(LIVE_CACHE_KEY, {
            ...data,
            mode: "live",
            fetchedAt: Date.now(),
            day: today,
          });
        }
      } catch {
        if (wallpaperMode === "static") {
          const pinned = readJson<StoredWallpaper>(PINNED_KEY);
          if (pinned?.url) setWallpaper(pinned);
          else setWallpaper(null);
        } else {
          const cached = readJson<StoredWallpaper>(LIVE_CACHE_KEY);
          if (
            cached?.url &&
            (cached.startDate === today || cached.day === today)
          ) {
            setWallpaper(cached);
          } else if (cached?.url) {
            setWallpaper(cached);
          } else {
            setWallpaper(null);
          }
        }
      } finally {
        setWallpaperLoading(false);
      }
    },
    [wallpaperMode, wallpaperIdx]
  );

  useEffect(() => {
    if (!ready) return;
    if (wallpaperMode === "off") {
      setWallpaper(null);
      return;
    }

    if (wallpaperMode === "static") {
      const pinned = readJson<StoredWallpaper>(PINNED_KEY);
      if (pinned?.url && pinned.idx === wallpaperIdx) {
        setWallpaper(pinned);
        return; // stay on the pinned photo — do not re-fetch Bing
      }
      // New day slot or first pin — fetch once and lock it
      void refreshWallpaper({ force: true });
      return;
    }

    // Live: show last good cache instantly, then pull today's Bing
    const today = localYmd();
    const cached = readJson<StoredWallpaper>(LIVE_CACHE_KEY);
    if (cached?.url) setWallpaper(cached);
    void refreshWallpaper();
    // Keep today in scope for clarity
    void today;
  }, [ready, wallpaperMode, wallpaperIdx, refreshWallpaper]);

  // Live only: refresh on a timer / focus / day change
  useEffect(() => {
    if (!ready || wallpaperMode !== "live") return;
    let lastDay = localYmd();
    const tick = () => {
      const day = localYmd();
      if (day !== lastDay) {
        lastDay = day;
        try {
          localStorage.removeItem(LIVE_CACHE_KEY);
        } catch {
          /* ignore */
        }
      }
      void refreshWallpaper();
    };
    const id = window.setInterval(tick, 30 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", tick);
    };
  }, [ready, wallpaperMode, refreshWallpaper]);

  const setTheme = useCallback((value: ThemeMode) => {
    setThemeState(value);
  }, []);

  const setPalette = useCallback((value: ThemePalette) => {
    setPaletteState(value);
  }, []);

  const setWallpaperMode = useCallback((mode: WallpaperMode) => {
    setWallpaperModeState(mode);
  }, []);

  const setWallpaperIdx = useCallback((idx: number) => {
    setWallpaperIdxState(Math.max(0, Math.min(7, Math.floor(idx))));
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const current = prev === "system" ? getSystemTheme() : prev;
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolved,
      setTheme,
      toggle,
      palette,
      setPalette,
      wallpaperMode,
      setWallpaperMode,
      wallpaperIdx,
      setWallpaperIdx,
      wallpaper,
      wallpaperLoading,
      refreshWallpaper,
    }),
    [
      theme,
      resolved,
      setTheme,
      toggle,
      palette,
      setPalette,
      wallpaperMode,
      setWallpaperMode,
      wallpaperIdx,
      setWallpaperIdx,
      wallpaper,
      wallpaperLoading,
      refreshWallpaper,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
