"use client";
import { useParams } from "next/navigation";
import { messages } from "@/lib/i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = messages(useParams().locale === "en" ? "en" : "hr");
  return (
    <main className="content-area">
      <h1>{t.failed}</h1>
      <button onClick={reset}>{t.retry}</button>
    </main>
  );
}
