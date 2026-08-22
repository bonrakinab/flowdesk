import { cn } from "@/lib/utils";
import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        size === "sm" && "rounded-lg px-3 py-1.5 text-xs",
        size === "md" && "rounded-xl px-4 py-2.5 text-sm",
        size === "lg" && "rounded-2xl px-5 py-3 text-sm",
        size === "icon" && "rounded-xl h-10 w-10 p-0",
        variant === "primary" &&
          "bg-accent text-white shadow-[0_8px_20px_rgba(13,148,136,0.28)] hover:bg-[#0f766e] hover:shadow-[0_10px_24px_rgba(13,148,136,0.35)] dark:text-stone-950 dark:hover:bg-[#2dd4bf]",
        variant === "secondary" &&
          "border border-border/80 bg-card/90 text-foreground shadow-sm hover:border-accent/30 hover:bg-white dark:hover:bg-white/5",
        variant === "soft" &&
          "bg-accent-soft text-accent hover:brightness-95 dark:text-teal-100 dark:hover:brightness-110",
        variant === "ghost" &&
          "text-muted hover:bg-stone-900/5 hover:text-foreground dark:hover:bg-white/5",
        variant === "danger" &&
          "bg-danger text-white shadow-[0_8px_20px_rgba(225,29,72,0.25)] hover:brightness-110 dark:text-stone-950",
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "field-control w-full rounded-xl border border-border/90 px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-accent focus:ring-[3px] focus:ring-accent/15 dark:placeholder:text-stone-400 dark:shadow-none dark:hover:border-stone-500",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "field-control w-full min-h-28 rounded-xl border border-border/90 px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-accent focus:ring-[3px] focus:ring-accent/15 resize-y dark:placeholder:text-stone-400 dark:shadow-none dark:hover:border-stone-500",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "field-control w-full appearance-none rounded-xl border border-border/90 px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition hover:border-stone-300 focus:border-accent focus:ring-[3px] focus:ring-accent/15 dark:hover:border-stone-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70",
        className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "accent" | "warm" | "danger" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        tone === "neutral" &&
          "bg-stone-900/8 text-foreground dark:bg-white/12 dark:text-stone-100",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "warm" && "bg-warm-soft text-warm",
        tone === "danger" &&
          "bg-rose-100 text-danger dark:bg-rose-950/50 dark:text-rose-200",
        tone === "success" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "panel-surface overflow-hidden rounded-3xl border border-border/70 bg-card/95",
        padded && "p-5 md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3 border-b border-border/60 pb-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-soft)]">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          {icon}
        </div>
      )}
      <h3 className="font-[family-name:var(--font-display)] text-xl text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/60 px-4 py-3 dark:bg-white/5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}
