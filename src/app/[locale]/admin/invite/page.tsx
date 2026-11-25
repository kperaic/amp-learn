import { readAll } from "@/lib/read-all";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { InvitationForm } from "@/components/admin/students";
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
      .select("*")
      .order("sort_order")
      .order("id")
      .range(from, to),
  );
  if (error) throw Error("Modules unavailable");
  return (
    <>
      <Link href={`/${locale}/admin/students`}>{t.backStudents}</Link>
      <h1>{t.invite}</h1>
      <section className="card">
        <InvitationForm locale={locale} modules={data as ModuleRow[]} />
      </section>
    </>
  );
}
