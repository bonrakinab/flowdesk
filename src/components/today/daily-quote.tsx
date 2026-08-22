"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { getDailyQuote } from "@/lib/daily-quote";

export function DailyQuote() {
  const quote = useMemo(() => getDailyQuote(), []);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="mt-12 border-t border-border/60 pt-8 pb-2 text-center"
    >
      <blockquote className="mx-auto max-w-md font-[family-name:var(--font-display)] text-lg leading-snug tracking-tight text-foreground md:text-xl">
        “{quote.text}”
      </blockquote>
      <figcaption className="mt-3 text-sm text-muted">
        — {quote.author}
      </figcaption>
    </motion.figure>
  );
}
