"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

export function PageBackdrop({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { wallpaperMode, wallpaper } = useTheme();
  const show = wallpaperMode !== "off" && Boolean(wallpaper?.url);

  return (
    <div
      className={cn(
        "relative min-h-full",
        show && "has-wallpaper",
        className
      )}
    >
      {show && wallpaper && (
        <>
          {/*
            Stay behind the sidebar: fixed to the content column only,
            and z-index below the rail (sidebar uses z-30).
            No frosted / white wash — wallpaper only.
          */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-y-0 right-0 z-[1] left-0 md:left-60"
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-700"
              style={{ backgroundImage: `url(${wallpaper.url})` }}
            />
          </div>
          {(wallpaper.title || wallpaper.copyright) && (
            <div className="pointer-events-none fixed bottom-16 right-4 z-[5] max-w-[min(70vw,22rem)] text-right text-[10px] leading-snug text-white/90 drop-shadow md:bottom-3 md:right-5">
              {wallpaper.title && (
                <div className="font-medium">{wallpaper.title}</div>
              )}
              {wallpaper.copyright && (
                <div className="truncate opacity-90">{wallpaper.copyright}</div>
              )}
            </div>
          )}
        </>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
