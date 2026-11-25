"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteArchivedModule, deleteInactiveStudent, deleteLesson, cleanupDeletedFiles } from "@/app/[locale]/admin/delete-actions";
import { Feedback } from "./common";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function PermanentDelete({ locale, kind, id, label, moduleId, disabled = false }: {
  locale: Locale; kind: "module" | "student" | "lesson"; id: string; label: string; moduleId?: string; disabled?: boolean;
}) {
  const t = messages(locale), router = useRouter();
  const [open, setOpen] = useState(false), [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false), [code, setCode] = useState("");
  const failure = kind === "lesson" ? "lessonDeleteFailed" : "deleteFailed";
  return <section className="card">
    <h2>{kind === "lesson" ? t.deleteLesson : kind === "module" ? t.deleteModule : t.deleteStudent}</h2>
    <p>{kind === "lesson" ? t.deleteLessonHelp : kind === "module" ? t.deleteModuleHelp : t.deleteStudentHelp}</p>
    {!open ? <button className="secondary" disabled={disabled} onClick={() => setOpen(true)}>{t.permanentDelete}</button> :
      <form className="foundation-form" onSubmit={async (event) => {
        event.preventDefault();
        if (confirmation !== label || disabled || busy) return;
        setBusy(true); setCode("");
        try {
          const result = await (kind === "lesson" ? deleteLesson : kind === "module" ? deleteArchivedModule : deleteInactiveStudent)(locale, id, confirmation);
          if (result.error) { setCode(result.error); setBusy(false); }
          else { router.replace(`/${locale}/admin/${kind === "lesson" ? `modules/${moduleId}` : kind === "module" ? "modules?archive=1" : "students"}`); router.refresh(); }
        } catch { setCode(failure); setBusy(false); }
      }}>
        <label className="field">
          <span>{t.deleteConfirmLabel}: <strong>{label}</strong></span>
          <input autoComplete="off" value={confirmation} disabled={busy || disabled} onChange={(e) => setConfirmation(e.target.value)} />
        </label>
        <div className="button-row">
          <button disabled={busy || disabled || confirmation !== label}>{busy ? t.working : t.permanentDelete}</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => { setOpen(false); setConfirmation(""); setCode(""); }}>{t.cancelDelete}</button>
        </div>
        <Feedback locale={locale} code={code} />
      </form>}
  </section>;
}

export function FileCleanup({ locale }: { locale: Locale }) {
  const t = messages(locale), router = useRouter();
  const [busy, setBusy] = useState(false), [code, setCode] = useState("");
  return <section className="card">
    <p>{t.cleanupPending}</p>
    <button className="secondary" disabled={busy} onClick={async () => {
      setBusy(true); setCode("");
      try { const result = await cleanupDeletedFiles(locale); setCode(result.error || "saved"); router.refresh(); }
      catch { setCode("cleanupPending"); }
      finally { setBusy(false); }
    }}>{busy ? t.working : t.retryCleanup}</button>
    <Feedback locale={locale} code={code} />
  </section>;
}
