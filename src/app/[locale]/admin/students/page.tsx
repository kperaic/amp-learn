import { readAll } from "@/lib/read-all";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { StudentList } from "@/components/admin/students";
import type { StudentRow, ModuleRow, ModuleAccessRow } from "@/lib/admin-types";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale),
    { supabase } = await requireAdmin(locale);
  const [students, access, modules] = await Promise.all([
    readAll((from, to) =>
      supabase
        .rpc("admin_student_directory")
        .order("last_name")
        .order("first_name")
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase
        .from("module_access")
        .select("student_id,module_id,granted_at")
        .order("student_id")
        .order("granted_at")
        .order("module_id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase.from("modules").select("id,title").order("id").range(from, to),
    ),
  ]);
  const error = students.error || access.error || modules.error;
  return (
    <>
      <div className="page-heading">
        <h1>{t.students}</h1>
        <p className="muted">{t.studentsHelp}</p>
        <Link className="button" href={`/${locale}/admin/invite`}>
          {t.invite}
        </Link>
      </div>
      <section className="card">
        {error ? (
          <p role="alert">{t.setupNeeded}</p>
        ) : (
          <StudentList
            locale={locale}
            students={students.data as StudentRow[]}
            access={access.data as ModuleAccessRow[]}
            modules={modules.data as Pick<ModuleRow, "id" | "title">[]}
          />
        )}
      </section>
    </>
  );
}
