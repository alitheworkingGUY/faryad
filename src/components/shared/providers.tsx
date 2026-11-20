"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <TooltipProvider delay={200}>
        {children}
        <Toaster position="top-center" richColors={false} closeButton />
      </TooltipProvider>
    </LangProvider>
  );
}
