"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Snowflake,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDeviceLocation } from "@/lib/native-location";
import { WeatherAtmosphere } from "@/components/weather/weather-atmosphere";
import { getWeatherAdvice } from "@/lib/weather-advice";

type WeatherData = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  isDay: boolean;
  label: string;
  icon: string;
  high: number;
  low: number;
  location: string;
  updatedAt: string;
};

type WeatherCache = {
  lat: number;
  lon: number;
  data: WeatherData;
  fetchedAt: number;
};

const CACHE_KEY = "flowdesk-weather-cache";
const WEATHER_FRESH_MS = 10 * 60_000;
const COORDS_FRESH_MS = 30 * 60_000;

const ICONS: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
};

function readCache(): WeatherCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WeatherCache;
  } catch {
    return null;
  }
}

function writeCache(cache: WeatherCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function locationErrorMessage(reason: string) {
  switch (reason) {
    case "denied":
      return "Allow location access to see local weather.";
    case "timeout":
      return "Location timed out. Tap refresh to try again.";
    case "unavailable":
      return "Location unavailable. Tap refresh to try again.";
    default:
      return "Could not get your location.";
  }
}

export function WeatherWidget({ className }: { className?: string }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWeather = useCallback(async (lat: number, lon: number) => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 9_000);
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Could not load weather");
      }
      setData(json);
      setError("");
      writeCache({ lat, lon, data: json, fetchedAt: Date.now() });
      return true;
    } catch {
      setError("Could not load weather");
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const locateAndLoad = useCallback(
    async (forceRefresh = false) => {
      setRefreshing(true);
      if (!data) setLoading(true);
      setError("");

      const cached = readCache();
      if (!forceRefresh && cached?.data && !data) {
        setData(cached.data);
        setLoading(false);
      }

      const coordsFresh =
        cached &&
        Date.now() - cached.fetchedAt < COORDS_FRESH_MS &&
        Number.isFinite(cached.lat) &&
        Number.isFinite(cached.lon);

      if (!forceRefresh && coordsFresh) {
        const weatherFresh = Date.now() - cached!.fetchedAt < WEATHER_FRESH_MS;
        if (weatherFresh && cached!.data) {
          setData(cached!.data);
          setLoading(false);
          setRefreshing(false);
          void getDeviceLocation({ forceRefresh: false }).then((result) => {
            if (result.ok) {
              void loadWeather(result.coords.latitude, result.coords.longitude);
            }
          });
          return;
        }
        await loadWeather(cached!.lat, cached!.lon);
        setLoading(false);
        setRefreshing(false);
        void getDeviceLocation({ forceRefresh: false });
        return;
      }

      const result = await getDeviceLocation({ forceRefresh });
      if (!result.ok) {
        if (cached?.data) {
          setData(cached.data);
          setError("");
        } else {
          setError(locationErrorMessage(result.reason));
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      await loadWeather(result.coords.latitude, result.coords.longitude);
      setLoading(false);
      setRefreshing(false);
    },
    [data, loadWeather]
  );

  useEffect(() => {
    void locateAndLoad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const Icon = data ? ICONS[data.icon] || Cloud : Cloud;
  const advice = data
    ? getWeatherAdvice({
        icon: data.icon,
        label: data.label,
        temperature: data.temperature,
        feelsLike: data.feelsLike,
        humidity: data.humidity,
        wind: data.wind,
        isDay: data.isDay,
      })
    : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]",
        className
      )}
    >
      {data ? (
        <WeatherAtmosphere icon={data.icon} isDay={data.isDay} />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/15 via-transparent to-accent/10"
        />
      )}

      <div className="relative z-10">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Live weather
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin size={11} />
              {loading && !data
                ? "Locating…"
                : refreshing && data
                  ? `${data.location} · updating`
                  : data?.location || "Unknown"}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            onClick={() => void locateAndLoad(true)}
            aria-label="Refresh weather"
          >
            <RefreshCw
              size={14}
              className={loading || refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {error && !data ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <p className="text-sm text-muted">{error}</p>
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => void locateAndLoad(true)}
              >
                Try again
              </button>
            </motion.div>
          ) : loading && !data ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-16 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5"
            >
              <motion.div
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-sky-600 shadow-sm backdrop-blur-sm dark:bg-white/10 dark:text-sky-300">
                    <Icon size={24} />
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-tight">
                      {Math.round(data.temperature)}°
                    </div>
                    <div className="mt-1 text-sm text-muted">{data.label}</div>
                  </div>
                </div>
                <div className="text-right text-[11px] leading-relaxed text-muted">
                  <div>
                    H {Math.round(data.high)}° · L {Math.round(data.low)}°
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <Wind size={10} /> {Math.round(data.wind)} km/h
                  </div>
                  <div className="inline-flex items-center justify-end gap-1">
                    <Droplets size={10} /> {Math.round(data.humidity)}% humidity
                  </div>
                  <div>Feels {Math.round(data.feelsLike)}°</div>
                </div>
              </div>

              {advice && (
                <div className="rounded-2xl border border-border/50 bg-card/80 px-3 py-2.5 backdrop-blur-sm">
                  <p className="text-[11px] font-medium leading-snug text-foreground/90">
                    {advice.summary}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-700 dark:text-teal-300">
                        <ThumbsUp size={10} /> Do
                      </div>
                      <ul className="space-y-1 text-[11px] leading-snug text-muted">
                        {advice.doList.map((item) => (
                          <li key={item} className="flex gap-1.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-600/80 dark:bg-teal-400/80" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300">
                        <ThumbsDown size={10} /> Skip
                      </div>
                      <ul className="space-y-1 text-[11px] leading-snug text-muted">
                        {advice.dontList.map((item) => (
                          <li key={item} className="flex gap-1.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-600/70 dark:bg-rose-400/70" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
