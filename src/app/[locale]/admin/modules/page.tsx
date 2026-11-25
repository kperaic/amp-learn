import { FileCleanup } from "@/components/admin/deletion";
import Link from "next/link";
import { readAll } from "@/lib/read-all";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { ModuleForm, OrderedList } from "@/components/admin/modules";
import type { ModuleRow } from "@/lib/admin-types";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ archive?: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale),
    { supabase } = await requireAdmin(locale);
  const archived = (await searchParams).archive === "1";
  const { data, error } = await readAll((from, to) =>
    supabase
      .from("modules")
      .select("*,lessons(count),module_access(count)")
      .order("sort_order")
      .order("id")
      .range(from, to),
  );
  if (error) throw Error("Modules unavailable");
  const cleanup = archived ? await supabase.from("file_deletion_queue").select("path", { count: "exact", head: true }) : null;
  if (cleanup?.error) throw Error("Cleanup status unavailable");
  const items = (
    data as (ModuleRow & {
      lessons: { count: number }[];
      module_access: { count: number }[];
    })[]
  ).filter((m) => !!m.archived_at === archived).map((m) => ({
    ...m,
    detail: `${t.lessons}: ${m.lessons[0]?.count || 0} · ${t.assigned}: ${m.module_access[0]?.count || 0}`,
  }));
  return (
    <>
      <h1>{archived ? t.archive : t.modules}</h1>
      <nav className="button-row">
        <Link className="button secondary" href={`/${locale}/admin/modules`}>{t.activeModules}</Link>
        <Link className="button secondary" href={`/${locale}/admin/modules?archive=1`}>{t.archive}</Link>
      </nav>
      <p className="muted">{archived ? t.archiveHelp : t.modulesHelp}</p>
      {!!cleanup?.count && <FileCleanup locale={locale} />}
      <section className="card">
        {archived && !items.length ? <p className="muted">{t.archiveEmpty}</p> : <OrderedList
          locale={locale}
          kind="modules"
          parent={null}
          items={items}
          sortable={!archived}
        />}
      </section>
      {!archived && <section className="card">
        <h2>{t.createModule}</h2>
        <ModuleForm locale={locale} />
      </section>}
    </>
  );
}
