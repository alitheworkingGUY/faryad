import { cn } from "@/lib/utils";

/** Faryad mark: a voice wave rising out of a location pin. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-10", className)} aria-hidden="true">
      <defs>
        <linearGradient id="faryad-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#faryad-g)" />
      <g fill="none" stroke="#04130D" strokeWidth="2.6" strokeLinecap="round">
        <path d="M12 17.5v5" />
        <path d="M16.5 13.5v13" />
        <path d="M21 10v20" />
        <path d="M25.5 14.5v11" />
        <path d="M30 18v4" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  size = "md",
  showUrdu = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showUrdu?: boolean;
}) {
  const mark = size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10";
  const word = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark className={mark} />
      <div className="flex items-baseline gap-2.5 leading-none">
        <span className={cn("font-semibold tracking-tight text-fg", word)}>Faryad</span>
        {showUrdu && (
          <span dir="rtl" lang="ur" className={cn("ur ur-tight text-live", size === "lg" ? "text-2xl" : "text-lg")}>
            فریاد
          </span>
        )}
      </div>
    </div>
  );
}
