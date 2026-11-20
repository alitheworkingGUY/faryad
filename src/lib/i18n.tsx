"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type Lang = "en" | "ur";

type LangContext = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  /** Picks the string for the current language. */
  t: (en: string, ur: string) => string;
  isUr: boolean;
};

const Ctx = createContext<LangContext>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
  t: (en) => en,
  isUr: false,
});

const KEY = "faryad.lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "ur" || saved === "en") setLangState(saved);
    } catch {
      // storage unavailable (private mode): stay on the default
    }
  }, []);

  // Urdu-first flips the whole document to RTL.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LangContext>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "ur" ? "en" : "ur"),
      t: (en, ur) => (lang === "ur" ? ur : en),
      isUr: lang === "ur",
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

/** Urdu text span: Nastaliq, RTL, tall line height. */
export function Ur({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div" | "p";
}) {
  return (
    <Tag dir="rtl" lang="ur" className={cn("ur", className)}>
      {children}
    </Tag>
  );
}

/**
 * Bilingual label: the current language leads, the other follows in a quieter style.
 * `stack` puts the secondary line underneath instead of beside.
 */
export function Bi({
  en,
  ur,
  className,
  secondaryClassName,
  stack = false,
  only = false,
}: {
  en: string;
  ur: string;
  className?: string;
  secondaryClassName?: string;
  stack?: boolean;
  /** Render just the current language. */
  only?: boolean;
}) {
  const { isUr } = useLang();
  const primary = isUr ? (
    <span dir="rtl" lang="ur" className="ur ur-tight">
      {ur}
    </span>
  ) : (
    <span>{en}</span>
  );
  if (only) return <span className={className}>{primary}</span>;
  const secondary = isUr ? (
    <span dir="ltr" className={cn("text-[0.78em] font-normal text-dim", secondaryClassName)}>
      {en}
    </span>
  ) : (
    <span dir="rtl" lang="ur" className={cn("ur ur-tight text-[0.82em] font-normal text-dim", secondaryClassName)}>
      {ur}
    </span>
  );
  return (
    <span className={cn(stack ? "inline-flex flex-col" : "inline-flex items-baseline gap-2", className)}>
      {primary}
      {secondary}
    </span>
  );
}
