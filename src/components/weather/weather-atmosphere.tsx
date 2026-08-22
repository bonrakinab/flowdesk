"use client";

import { cn } from "@/lib/utils";

type Props = {
  icon: string;
  isDay?: boolean;
  className?: string;
};

function CloudLayer({
  count,
  speedMin,
  speedMax,
  topMin,
  topMax,
  sizeMin,
  sizeMax,
  opacity = 1,
}: {
  count: number;
  speedMin: number;
  speedMax: number;
  topMin: number;
  topMax: number;
  sizeMin: number;
  sizeMax: number;
  opacity?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const t = i / Math.max(count - 1, 1);
        const top = topMin + (topMax - topMin) * t + ((i * 7) % 11) - 5;
        const width = sizeMin + ((i * 13) % (sizeMax - sizeMin + 1));
        const height = Math.round(width * 0.38);
        const duration = speedMin + ((i * 17) % (speedMax - speedMin + 1));
        const delay = -((i * 2.3) % duration);
        return (
          <span
            key={i}
            className="wx-cloud"
            style={{
              top: `${Math.max(2, Math.min(70, top))}%`,
              width,
              height,
              opacity,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </>
  );
}

function RainLayer({ count, dense }: { count: number; dense?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const left = ((i * 37) % 100) + (i % 3);
        const duration = dense ? 0.55 + (i % 5) * 0.08 : 0.75 + (i % 6) * 0.1;
        const delay = -((i * 0.17) % 2.2);
        const height = dense ? 12 + (i % 4) * 3 : 10 + (i % 5) * 2;
        return (
          <span
            key={i}
            className="wx-drop"
            style={{
              left: `${left % 100}%`,
              height,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </>
  );
}

function SnowLayer({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const left = ((i * 41) % 100) + (i % 5) * 0.4;
        const duration = 3.2 + (i % 7) * 0.45;
        const delay = -((i * 0.35) % 4);
        const size = 4 + (i % 4);
        return (
          <span
            key={i}
            className="wx-flake"
            style={{
              left: `${left % 100}%`,
              width: size,
              height: size,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </>
  );
}

function MoonScene({ withClouds }: { withClouds?: boolean }) {
  return (
    <>
      <div className="absolute -right-1 -top-3 h-32 w-32">
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 shadow-[0_0_28px_rgba(148,163,184,0.6)] ring-4 ring-slate-300/30 dark:from-slate-400 dark:via-slate-300 dark:to-slate-500 dark:shadow-[0_0_36px_rgba(203,213,225,0.5)] dark:ring-slate-400/25" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/4 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-950/20 to-slate-800/30 dark:from-slate-900/30 dark:to-indigo-950/20" />
      </div>
      {withClouds ? (
        <CloudLayer
          count={4}
          speedMin={32}
          speedMax={48}
          topMin={48}
          topMax={74}
          sizeMin={52}
          sizeMax={95}
          opacity={0.9}
        />
      ) : null}
    </>
  );
}

function SunScene({ withClouds }: { withClouds?: boolean }) {
  return (
    <>
      <div className="absolute -right-1 -top-3 h-32 w-32">
        <div className="wx-sun-rays absolute inset-0">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-[48%] w-[3.5px] origin-top rounded-full bg-amber-500/80 dark:bg-amber-200/45"
              style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
            />
          ))}
        </div>
        <div className="wx-sun-core absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 shadow-[0_0_36px_rgba(245,158,11,0.75)] ring-4 ring-amber-200/70 dark:ring-amber-300/30" />
      </div>
      {withClouds ? (
        <CloudLayer
          count={4}
          speedMin={28}
          speedMax={42}
          topMin={48}
          topMax={74}
          sizeMin={52}
          sizeMax={95}
          opacity={1}
        />
      ) : null}
    </>
  );
}

function FogScene() {
  return (
    <>
      <CloudLayer
        count={4}
        speedMin={40}
        speedMax={55}
        topMin={8}
        topMax={30}
        sizeMin={70}
        sizeMax={110}
        opacity={0.65}
      />
      <span className="wx-fog-band" style={{ top: "35%", animationDuration: "9s" }} />
      <span
        className="wx-fog-band"
        style={{ top: "55%", animationDuration: "12s", animationDelay: "-3s" }}
      />
      <span
        className="wx-fog-band"
        style={{ top: "72%", animationDuration: "10s", animationDelay: "-6s" }}
      />
    </>
  );
}

function StormScene() {
  return (
    <>
      <CloudLayer
        count={6}
        speedMin={18}
        speedMax={28}
        topMin={0}
        topMax={28}
        sizeMin={70}
        sizeMax={120}
        opacity={1}
      />
      <RainLayer count={30} dense />
      <span className="wx-bolt" style={{ left: "28%", top: "22%", animationDelay: "0s" }} />
      <span className="wx-bolt" style={{ left: "62%", top: "18%", animationDelay: "-2.1s" }} />
    </>
  );
}

const SKY: Record<string, string> = {
  sun: "from-sky-400/70 via-sky-200/50 to-amber-100/40 dark:from-indigo-950/40 dark:via-transparent dark:to-slate-900/20",
  moon: "from-indigo-900/50 via-slate-700/30 to-slate-800/20 dark:from-indigo-950/50 dark:via-transparent dark:to-slate-900/25",
  "moon-star": "from-indigo-900/50 via-slate-700/30 to-slate-800/20 dark:from-indigo-950/50 dark:via-transparent dark:to-slate-900/25",
  "cloud-sun":
    "from-sky-400/55 via-sky-200/35 to-slate-200/40 dark:from-sky-900/30 dark:via-transparent dark:to-slate-700/25",
  "cloud-moon":
    "from-indigo-800/45 via-slate-600/30 to-slate-700/25 dark:from-indigo-950/45 dark:via-transparent dark:to-slate-800/20",
  cloud:
    "from-slate-400/55 via-slate-300/40 to-sky-200/35 dark:from-slate-600/40 dark:via-transparent dark:to-slate-800/30",
  "cloud-fog":
    "from-slate-400/50 via-slate-300/45 to-slate-200/40 dark:from-slate-600/35 dark:via-transparent dark:to-slate-800/25",
  "cloud-drizzle":
    "from-slate-500/50 via-sky-300/35 to-slate-300/30 dark:from-slate-700/45 dark:via-sky-950/20 dark:to-transparent",
  "cloud-rain":
    "from-slate-500/55 via-sky-400/30 to-slate-400/35 dark:from-slate-700/50 dark:via-sky-950/25 dark:to-transparent",
  snow: "from-sky-300/55 via-slate-200/50 to-sky-100/45 dark:from-slate-600/40 dark:via-transparent dark:to-slate-800/30",
  storm:
    "from-slate-600/60 via-indigo-400/25 to-slate-500/40 dark:from-slate-800/55 dark:via-indigo-950/30 dark:to-transparent",
};

export function WeatherAtmosphere({ icon, isDay = true, className }: Props) {
  const sky = SKY[icon] || SKY.cloud;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br transition-colors duration-700", sky)} />

      {icon === "sun" ? <SunScene /> : null}
      {icon === "moon" || icon === "moon-star" ? <MoonScene /> : null}
      {icon === "cloud-sun" ? <SunScene withClouds /> : null}
      {icon === "cloud-moon" ? <MoonScene withClouds /> : null}
      {icon === "cloud" ? (
        <CloudLayer
          count={7}
          speedMin={22}
          speedMax={38}
          topMin={4}
          topMax={55}
          sizeMin={55}
          sizeMax={115}
          opacity={1}
        />
      ) : null}
      {icon === "cloud-fog" ? <FogScene /> : null}
      {icon === "cloud-drizzle" ? (
        <>
          <CloudLayer
            count={5}
            speedMin={24}
            speedMax={36}
            topMin={0}
            topMax={28}
            sizeMin={60}
            sizeMax={100}
            opacity={1}
          />
          <RainLayer count={16} />
        </>
      ) : null}
      {icon === "cloud-rain" ? (
        <>
          <CloudLayer
            count={6}
            speedMin={20}
            speedMax={32}
            topMin={0}
            topMax={26}
            sizeMin={65}
            sizeMax={110}
            opacity={1}
          />
          <RainLayer count={26} dense />
        </>
      ) : null}
      {icon === "snow" ? (
        <>
          <CloudLayer
            count={5}
            speedMin={26}
            speedMax={40}
            topMin={0}
            topMax={24}
            sizeMin={60}
            sizeMax={105}
            opacity={1}
          />
          <SnowLayer count={24} />
        </>
      ) : null}
      {icon === "storm" ? <StormScene /> : null}

      {/* Keep text readable without washing out the scene in light mode */}
      <div className="absolute inset-0 bg-gradient-to-t from-card/70 via-card/10 to-transparent dark:from-card/80 dark:via-card/25" />
    </div>
  );
}
