import { readAll } from "@/lib/read-all";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { StudentEditor } from "@/components/admin/students";
import { uuid } from "@/lib/admin-validation";
import type { StudentRow, ModuleRow } from "@/lib/admin-types";
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
  const [s, m, a] = await Promise.all([
    supabase
      .rpc("admin_student_directory")
      .eq("id", id)
      .maybeSingle<StudentRow>(),
    readAll((from, to) =>
      supabase
        .from("modules")
        .select("*")
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase
        .from("module_access")
        .select("module_id,granted_at")
        .eq("student_id", id)
        .order("module_id")
        .range(from, to),
    ),
  ]);
  if (s.error || m.error || a.error) throw Error("Student unavailable");
  const student = s.data;
  if (!student) notFound();
  return (
    <>
      <Link href={`/${locale}/admin/students`}>{t.backStudents}</Link>
      <h1>
        {student.first_name} {student.last_name}
      </h1>
      <StudentEditor
        locale={locale}
        student={student}
        modules={m.data as ModuleRow[]}
        access={a.data.map((a) => a.module_id)}
        grantedAt={Object.fromEntries(
          a.data.map((a) => [a.module_id, a.granted_at]),
        )}
      />
    </>
  );
}
