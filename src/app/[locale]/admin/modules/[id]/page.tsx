import { readAll } from "@/lib/read-all";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { uuid } from "@/lib/admin-validation";
import {
  ModuleForm,
  ModuleArchive,
  OrderedList,
  NewLesson,
  CoverUpload,
} from "@/components/admin/modules";
import type { ModuleRow, LessonRow } from "@/lib/admin-types";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params,
    locale = localeOf(raw),
    t = messages(locale),
    { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success) notFound();
  const [m, l] = await Promise.all([
    supabase.from("modules").select("*").eq("id", id).maybeSingle(),
    readAll((from, to) =>
      supabase
        .from("lessons")
        .select("*")
        .eq("module_id", id)
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (m.error || l.error) throw Error("Content unavailable");
  if (!m.data) notFound();
  const item = m.data as ModuleRow;
  let cover: string | undefined;
  if (item.cover_path) {
    const r = await supabase.storage
      .from("module-covers")
      .createSignedUrl(item.cover_path, 300);
    cover = r.data?.signedUrl;
  }
  return (
    <>
      <Link href={`/${locale}/admin/modules`}>{t.backModules}</Link>
      <h1>{item.title}</h1>
      <ModuleArchive locale={locale} module={item} />
      <div className="admin-grid">
        <section className="card">
          <ModuleForm locale={locale} module={item} />
        </section>
        <section className="card">
          <CoverUpload locale={locale} module={id} url={cover} />
        </section>
      </div>
      <section className="card">
        <h2>{t.lessons}</h2>
        <OrderedList
          locale={locale}
          kind="lessons"
          parent={id}
          items={l.data as LessonRow[]}
        />
        <h3>{t.createLesson}</h3>
        <NewLesson locale={locale} module={id} />
      </section>
    </>
  );
}
