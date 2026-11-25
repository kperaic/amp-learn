import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { Empty } from "@/components/ui";
import { readAll } from "@/lib/read-all";
import { moduleProgress, type LessonSummary } from "@/lib/learning";
import { coverUrl } from "@/lib/learning-server";
import { LearningProgress } from "@/components/learn/progress";
import type { ModuleRow } from "@/lib/admin-types";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale),
    { supabase, profile } = await requireProfile(locale);
  const [modules, lessons, progress] = await Promise.all([
    readAll((from, to) =>
      supabase
        .from("modules")
        .select("*")
        .eq("status", "published")
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase
        .from("lessons")
        .select("id,module_id,title,status,sort_order")
        .eq("status", "published")
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", profile.id)
        .order("lesson_id")
        .range(from, to),
    ),
  ]);
  if (modules.error || lessons.error || progress.error)
    throw Error("Learning unavailable");
  const cards = await Promise.all(
    (modules.data as ModuleRow[]).map(async (item) => ({
      item,
      cover: await coverUrl(item),
      progress: moduleProgress(
        (lessons.data as LessonSummary[]).filter(
          (l) => l.module_id === item.id,
        ),
        progress.data.map((p) => p.lesson_id),
      ),
    })),
  );
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">AMP Learn</p>
        <h1>{t.myModules}</h1>
      </div>
      {cards.length ? (
        <div className="learning-modules">
          {cards.map(({ item, cover, progress: p }) => (
            <article className="learning-module" key={item.id}>
              {cover && <img src={cover} alt="" className="module-cover" />}
              <div className="module-body">
                <h2>
                  <Link href={`/${locale}/learn/modules/${item.id}`}>
                    {item.title}
                  </Link>
                </h2>
                {item.description && (
                  <p className="module-excerpt muted">{item.description}</p>
                )}
                <LearningProgress locale={locale} {...p} />
                <Link
                  className="button"
                  href={
                    p.next
                      ? `/${locale}/learn/lessons/${p.next}`
                      : `/${locale}/learn/modules/${item.id}`
                  }
                >
                  {p.total === 0
                    ? t.openModule
                    : p.next
                      ? p.completed
                        ? t.continueLearning
                        : t.startLearning
                      : t.revisitModule}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={t.noAccessibleModules}
          description={t.noAccessibleModulesHelp}
        />
      )}
    </>
  );
}
