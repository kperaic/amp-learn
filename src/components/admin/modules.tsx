"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveModule,
  createLesson,
  reorder,
  prepareCover,
  finishCover,
} from "@/app/[locale]/admin/actions";
import { Feedback, StatusSelect, useUnsaved } from "./common";
import { messages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/browser";
import { fileMime } from "@/lib/admin-validation";
import type { Locale } from "@/lib/types";
import type { ModuleRow } from "@/lib/admin-types";
export function ModuleForm({
  locale,
  module,
}: {
  locale: Locale;
  module?: ModuleRow;
}) {
  const t = messages(locale),
    router = useRouter();
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [version, setVersion] = useState(module?.updated_at),
    [status, setStatus] = useState(module?.status || "draft");
  useUnsaved(dirty || busy, locale);
  return (
    <form
      className="foundation-form"
      onChange={() => { setDirty(true); setCode(""); }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          f = new FormData(form);
        setBusy(true);
        setCode("");
        try {
          const result = await saveModule(locale, module?.id || null, {
            title: f.get("title"),
            description: f.get("description"),
            status,
            version,
          });
          if (result.error !== undefined) setCode(result.error);
          else {
            setCode("saved");
            setDirty(false);
            setVersion(result.data.updated_at);
            if (!module) router.push(`/${locale}/admin/modules/${result.data.id}`);
            else router.refresh();
          }
        } catch {
          setCode("failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label className="field">
          <span>{t.title}</span>
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={module?.title}
          />
        </label>
        <label className="field">
          <span>{t.description}</span>
          <textarea
            name="description"
            rows={4}
            maxLength={10000}
            defaultValue={module?.description || ""}
          />
        </label>
        <StatusSelect
          locale={locale}
          value={status}
          onChange={(v) => setStatus(v as "draft" | "published")}
        />
        <button>
          {busy ? t.working : module ? t.saveChanges : t.createModule}
        </button>
      </fieldset>
      <Feedback locale={locale} code={code} />
    </form>
  );
}
export function OrderedList({
  locale,
  kind,
  parent,
  items,
}: {
  locale: Locale;
  kind: "modules" | "lessons";
  parent: string | null;
  items: { id: string; title: string; status: string; detail?: string }[];
}) {
  const t = messages(locale),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  async function move(index: number, offset: number) {
    const ids = items.map((x) => x.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    setBusy(true);
    try {
      const r = await reorder(locale, kind, parent, ids);
      setCode(r.error || "saved");
      router.refresh();
    } catch {
      setCode("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Feedback locale={locale} code={code} />
      <div className="ordered-list">
        {items.map((item, i) => (
          <article className="list-row" key={item.id}>
            <div>
              <Link
                className="row-title"
                href={`/${locale}/admin/${kind}/${item.id}`}
              >
                {item.title}
              </Link>
              <p className="muted">{item.detail}</p>
            </div>
            <span className="badge">
              {item.status === "published" ? t.published : t.draft}
            </span>
            <div className="button-row">
              <button
                className="secondary compact"
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
                aria-label={`${t.up}: ${item.title}`}
              >
                {t.up}
              </button>
              <button
                className="secondary compact"
                disabled={busy || i === items.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`${t.down}: ${item.title}`}
              >
                {t.down}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <p className="muted">
          {kind === "modules" ? t.noModules : t.noLessons}
        </p>
      )}
    </>
  );
}
export function NewLesson({
  locale,
  module,
}: {
  locale: Locale;
  module: string;
}) {
  const t = messages(locale),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const title = String(new FormData(e.currentTarget).get("title"));
        setBusy(true);
        try {
          const r = await createLesson(locale, module, title);
          if (r.error !== undefined) setCode(r.error);
          else router.push(`/${locale}/admin/lessons/${r.data}`);
        } catch {
          setCode("failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>{t.title}</span>
        <input name="title" maxLength={200} required />
      </label>
      <button disabled={busy}>{busy ? t.working : t.createLesson}</button>
      <Feedback locale={locale} code={code} />
    </form>
  );
}
export function CoverUpload({
  locale,
  module,
  url,
}: {
  locale: Locale;
  module: string;
  url?: string;
}) {
  const t = messages(locale),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  useUnsaved(busy, locale);
  return (
    <section className="cover-control">
      <h2>{t.cover}</h2>
      {url && <img src={url} alt={t.cover} className="cover-image" />}
      <p className="muted">{t.coverHelp}</p>
      <input
        aria-label={t.cover}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = "";
          setBusy(true);
          try {
            const type = fileMime(file.name);
            if (!type) throw Error();
            const r = await prepareCover(locale, module, {
              name: file.name,
              size: file.size,
              type,
            });
            if (r.error !== undefined) {
              setCode(r.error);
              return;
            }
            const supabase = createClient();
            const uploaded = await supabase.storage
              .from("module-covers")
              .upload(r.data, file, { contentType: type, upsert: false });
            if (uploaded.error) {
              setCode("uploadFailed");
              return;
            }
            const finish = await finishCover(locale, module, r.data);
            setCode(finish.error || "saved");
            router.refresh();
          } catch {
            setCode("uploadFailed");
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <p role="status">{t.working}</p>}
      <Feedback locale={locale} code={code} />
    </section>
  );
}
