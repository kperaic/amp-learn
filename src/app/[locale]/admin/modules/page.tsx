import { readAll } from "@/lib/read-all";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { ModuleForm, OrderedList } from "@/components/admin/modules";
import type { ModuleRow } from "@/lib/admin-types";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale),
    { supabase } = await requireAdmin(locale);
  const { data, error } = await readAll((from, to) =>
    supabase
      .from("modules")
      .select("*,lessons(count),module_access(count)")
      .order("sort_order")
      .order("id")
      .range(from, to),
  );
  if (error) throw Error("Modules unavailable");
  const items = (
    data as (ModuleRow & {
      lessons: { count: number }[];
      module_access: { count: number }[];
    })[]
  ).map((m) => ({
    ...m,
    detail: `${t.lessons}: ${m.lessons[0]?.count || 0} · ${t.assigned}: ${m.module_access[0]?.count || 0}`,
  }));
  return (
    <>
      <h1>{t.modules}</h1>
      <p className="muted">{t.modulesHelp}</p>
      <section className="card">
        <OrderedList
          locale={locale}
          kind="modules"
          parent={null}
          items={items}
        />
      </section>
      <section className="card">
        <h2>{t.createModule}</h2>
        <ModuleForm locale={locale} />
      </section>
    </>
  );
}
