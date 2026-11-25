"use client";
import { useEffect } from "react";
import type { Locale } from "@/lib/types";
// Root layouts persist during client navigation; keep document language aligned.
export function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
