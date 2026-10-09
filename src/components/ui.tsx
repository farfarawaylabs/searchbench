import * as React from "react";
import { cn } from "../lib/cn";

export function Button({
  className,
  variant = "primary",
  buttonRef,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "link";
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-ink text-white hover:-translate-y-px hover:shadow-lg active:translate-y-0",
        variant === "secondary" &&
          "bg-mist/60 text-ink border border-ink/10 hover:bg-mist",
        variant === "ghost" && "text-muted-ink hover:text-ink hover:bg-mist/50",
        variant === "link" && "text-muted-ink hover:text-ink px-0 py-0 rounded-none",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[32px] bg-white p-2 card-shadow", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "good" | "bad" | "accent" | "cream" | "lav";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-mist/70 text-ink",
        tone === "good" && "bg-emerald-100 text-emerald-900",
        tone === "bad" && "bg-red-100 text-red-900",
        tone === "accent" && "bg-ink text-white",
        tone === "cream" && "bg-cream text-ink",
        tone === "lav" && "bg-lav text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-mist/70", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  inputRef,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={inputRef}
      className={cn(
        "w-full rounded-[28px] border border-ink/10 bg-white p-5 text-[15px] leading-relaxed text-ink placeholder:text-muted-ink/70 outline-none focus:border-ink/30 focus:ring-4 focus:ring-lav/60 resize-none",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "toggle"}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer",
        checked ? "bg-ink" : "bg-mist",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-mist/70", className)}>
      <div
        className="h-full rounded-full bg-ink transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-ink/8", className)} />;
}

export function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white p-1">
      <button
        type="button"
        aria-label="decrease"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-ink hover:bg-mist/70 disabled:opacity-30 cursor-pointer"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="increase"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-ink hover:bg-mist/70 disabled:opacity-30 cursor-pointer"
      >
        +
      </button>
    </div>
  );
}
