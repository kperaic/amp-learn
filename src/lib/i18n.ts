import { notFound } from "next/navigation";
import hr from "@/messages/hr";
import en from "@/messages/en";
import type { Locale } from "./types";
export type Messages = typeof hr;
export function localeOf(value: string): Locale {
  if (value !== "hr" && value !== "en") notFound();
  return value;
}
export function messages(locale: Locale): Messages {
  return locale === "en" ? en : hr;
}
