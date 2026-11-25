import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale),
    { supabase } = await requireAdmin(locale);
  const results = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("active", true),
    supabase.from("modules").select("id", { count: "exact", head: true }),
    supabase
      .from("modules")
      .select("id", { count: "exact", head: true })
      .eq("status", "published").is("archived_at", null),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
  ]);
  if (results.some((r) => r.error)) throw Error("Dashboard unavailable");
  const labels = [
    t.totalStudents,
    t.activeStudents,
    t.totalModules,
    t.publishedModules,
    t.totalLessons,
  ];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">AMP Learn</p>
        <h1>{t.overview}</h1>
        <p className="muted">{t.adminIntro}</p>
      </div>
      <div className="stats-grid">
        {results.map((r, i) => (
          <article className="card stat" key={labels[i]}>
            <span>{labels[i]}</span>
            <strong>{r.count || 0}</strong>
          </article>
        ))}
      </div>
      <div className="button-row">
        <Link className="button" href={`/${locale}/admin/modules`}>
          {t.modules}
        </Link>
        <Link className="button secondary" href={`/${locale}/admin/students`}>
          {t.students}
        </Link>
      </div>
    </>
  );
}
