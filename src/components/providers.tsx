"use client";

import { SessionProvider } from "next-auth/react";
import { PomodoroProvider } from "@/components/pomodoro/pomodoro-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <PomodoroProvider>{children}</PomodoroProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
