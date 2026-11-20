"use client";

import { Inbox, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-40 flex-col items-center justify-center gap-4 text-dim", className)}>
      <div className="relative size-10">
        <span className="absolute inset-0 rounded-full border-2 border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-live" />
      </div>
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full border border-danger/40 bg-danger/10 text-danger">
        <TriangleAlert className="size-5" />
      </span>
      <p className="text-base font-medium text-fg">
        <Bi en="Something went wrong" ur="کچھ غلط ہو گیا" />
      </p>
      <p className="max-w-sm text-sm text-dim">{message}</p>
      {onRetry && (
        <Button variant="outline" size="lg" onClick={onRetry} className="mt-1">
          <RefreshCw /> <Bi en="Try again" ur="دوبارہ کوشش کریں" only />
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  titleUr,
  hint,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  titleUr: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full border border-line bg-panel-2 text-dim">
        <Icon className="size-5" />
      </span>
      <p className="text-base font-medium text-fg">
        <Bi en={title} ur={titleUr} />
      </p>
      {hint && <p className="max-w-sm text-sm text-dim">{hint}</p>}
      {children}
    </div>
  );
}
