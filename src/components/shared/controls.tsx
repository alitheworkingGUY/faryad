"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native select in the Faryad style: dependable on every device, keyboard friendly. */
export function SelectBox({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-line bg-panel ps-3 pe-9 text-sm text-fg outline-none transition-colors",
          "hover:border-[#2a3757] focus-visible:border-live focus-visible:ring-2 focus-visible:ring-live/30",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-panel text-fg">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 size-4 text-dim" />
    </label>
  );
}

export function Panel({
  title,
  titleUr,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  titleUr?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded-2xl border border-line bg-panel", className)}>
      {title && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold tracking-wide text-fg uppercase">
            {title}
            {titleUr && (
              <span dir="rtl" lang="ur" className="ur ur-tight text-[13px] font-normal text-dim normal-case">
                {titleUr}
              </span>
            )}
          </h2>
          {action}
        </header>
      )}
      <div className={cn("min-h-0 flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
