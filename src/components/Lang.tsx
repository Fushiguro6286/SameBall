"use client";

import { useEffect } from "react";
import { loadLang, saveLang } from "@/lib/client/storage";
import { FEATURES } from "@/lib/config";
import { setLang, textAt, type TextKey } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

/** A dictionary string, for server components (they render once, in English). */
export function Tx({ k }: { k: TextKey }) {
  return textAt(useT(), k);
}

/** Applies the saved (or browser) language once the page has hydrated. */
export function LangInit() {
  const lang = useLang();
  useEffect(() => {
    if (FEATURES.hindi) setLang(loadLang());
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  if (!FEATURES.hindi) return null;
  const next = lang === "hi" ? "en" : "hi";
  return (
    <button
      type="button"
      lang={next}
      onClick={() => {
        saveLang(next);
        setLang(next);
      }}
      className={`rounded-full border border-line px-3 py-1 text-sm ${className}`}
    >
      {next === "hi" ? "हिंदी" : "English"}
    </button>
  );
}
