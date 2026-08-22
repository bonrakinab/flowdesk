"use client";

import { ChevronLeft, ChevronRight, ImageIcon, Monitor, Moon, Sun } from "lucide-react";
import {
  THEME_PALETTES,
  useTheme,
  type ThemeMode,
  type ThemePalette,
  type WallpaperMode,
} from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const modeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const wallpaperOptions: { value: WallpaperMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "live", label: "Live" },
  { value: "static", label: "Pinned" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, toggle, resolved } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-xl border border-border/80 bg-card text-foreground transition hover:border-accent/40 hover:text-accent"
        aria-label="Toggle theme"
        title={`Theme: ${resolved}`}
      >
        {resolved === "dark" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    );
  }

  return (
    <div className="flex rounded-xl border border-border/80 bg-card/80 p-1">
      {modeOptions.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "bg-accent text-white shadow-sm dark:text-stone-950"
                : "text-muted hover:text-foreground"
            )}
          >
            <Icon size={13} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PalettePicker() {
  const { palette, setPalette } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {THEME_PALETTES.map((opt) => {
        const active = palette === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPalette(opt.id as ThemePalette)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-left transition",
              active
                ? "border-accent bg-accent-soft shadow-sm"
                : "border-border/80 bg-card/70 hover:border-accent/35"
            )}
          >
            <div className="flex items-center gap-2">
              <PaletteSwatch id={opt.id} />
              <div>
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-[10px] text-muted">{opt.blurb}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PaletteSwatch({ id }: { id: ThemePalette }) {
  const colors: Record<ThemePalette, [string, string, string]> = {
    default: ["#0d9488", "#f4f0e8", "#c2410c"],
    glass: ["#5eead4", "#94a3b8", "#e2e8f0"],
    ocean: ["#0891b2", "#0f172a", "#67e8f9"],
    ember: ["#ea580c", "#1c1917", "#fdba74"],
    slate: ["#64748b", "#0f172a", "#cbd5e1"],
  };
  const [a, b, c] = colors[id];
  return (
    <span className="inline-flex h-7 w-7 overflow-hidden rounded-full border border-border/60 shadow-sm">
      <span className="h-full w-1/3" style={{ background: a }} />
      <span className="h-full w-1/3" style={{ background: b }} />
      <span className="h-full w-1/3" style={{ background: c }} />
    </span>
  );
}

export function WallpaperControls() {
  const {
    wallpaperMode,
    setWallpaperMode,
    wallpaperIdx,
    setWallpaperIdx,
    wallpaper,
    wallpaperLoading,
    refreshWallpaper,
  } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap rounded-xl border border-border/80 bg-card/80 p-1">
        {wallpaperOptions.map((opt) => {
          const active = wallpaperMode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWallpaperMode(opt.value)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none",
                active
                  ? "bg-accent text-white shadow-sm dark:text-stone-950"
                  : "text-muted hover:text-foreground"
              )}
            >
              {opt.value !== "off" && <ImageIcon size={12} />}
              {opt.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        {wallpaperMode === "live" &&
          "Live always shows Bing’s photo of the day and updates automatically."}
        {wallpaperMode === "static" &&
          "Pinned locks one photo from the last 8 days and keeps it — it won’t change overnight."}
        {wallpaperMode === "off" &&
          "Off leaves page backgrounds as the solid theme color."}
      </p>

      {wallpaperMode === "static" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card hover:border-accent/40"
            onClick={() => setWallpaperIdx(wallpaperIdx + 1)}
            aria-label="Older wallpaper"
            disabled={wallpaperIdx >= 7}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-0 flex-1 text-center text-xs text-muted">
            Pin day −{wallpaperIdx}
            {wallpaper?.title ? ` · ${wallpaper.title}` : ""}
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card hover:border-accent/40"
            onClick={() => setWallpaperIdx(Math.max(0, wallpaperIdx - 1))}
            aria-label="Newer wallpaper"
            disabled={wallpaperIdx <= 0}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-accent/40"
            onClick={() => void refreshWallpaper({ force: true })}
            disabled={wallpaperLoading}
            title="Re-download this day from Bing and re-pin it"
          >
            {wallpaperLoading ? "…" : "Re-pin"}
          </button>
        </div>
      )}

      {wallpaperMode === "live" && (
        <button
          type="button"
          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-accent/40"
          onClick={() => void refreshWallpaper()}
          disabled={wallpaperLoading}
        >
          {wallpaperLoading ? "Updating…" : "Refresh today’s photo"}
        </button>
      )}

      {wallpaperMode !== "off" && wallpaper?.url && (
        <div
          className="h-24 overflow-hidden rounded-2xl border border-border bg-cover bg-center"
          style={{ backgroundImage: `url(${wallpaper.url})` }}
          title={wallpaper.copyright || wallpaper.title}
        />
      )}
    </div>
  );
}
