"use client";

import { Heart } from "lucide-react";

export function MadeWithLoveFooter() {
  return (
    <footer className="pointer-events-none select-none px-4 pb-6 pt-10 md:pb-8">
      <p className="credit-float mx-auto flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-muted md:text-sm">
        <span>Made with</span>
        <Heart
          size={13}
          className="inline fill-rose-500 text-rose-500 drop-shadow-sm"
          aria-label="love"
        />
        <span>
          by <span className="font-medium text-foreground/80">Arnob</span> for
          the Fam
        </span>
        <Heart
          size={13}
          className="inline fill-rose-500 text-rose-500 drop-shadow-sm"
          aria-label="love"
        />
      </p>
    </footer>
  );
}
