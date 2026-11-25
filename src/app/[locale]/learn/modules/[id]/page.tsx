import Link from "next/link";
import { localeOf, messages } from "@/lib/i18n";
import { moduleData } from "@/lib/learning-data";
import { moduleProgress } from "@/lib/learning";
import { coverUrl } from "@/lib/learning-server";
import { LearningProgress } from "@/components/learn/progress";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params,
    locale = localeOf(raw),
    t = messages(locale),
    data = await moduleData(locale, id);
  const cover = await coverUrl(data.module),
    p = moduleProgress(data.lessons, data.completed);
  return (
    <>
      <Link className="button secondary learning-back" href={`/${locale}/learn`}>
        <span aria-hidden="true">←</span> {t.myModules}
      </Link>
      {data.admin && <p className="notice">{t.adminPreview}</p>}
      <header className="module-heading">
        {cover && <img src={cover} alt="" className="module-cover" />}
        <h1>{data.module.title}</h1>
        {data.module.description && (
          <p className="module-description">{data.module.description}</p>
        )}
        <LearningProgress locale={locale} {...p} />
      </header>
      <h2>{t.lessons}</h2>
      {data.lessons.length ? (
        <ol className="learning-lessons">
          {data.lessons.map((l, i) => (
            <li key={l.id}>
              <Link href={`/${locale}/learn/lessons/${l.id}`}>
                <span className="lesson-number">
                  {data.completed.includes(l.id) ? "✓" : i + 1}
                </span>
                <span>
                  {l.title}
                  {l.status === "draft" && <small> · {t.draft}</small>}
                </span>
                <small>
                  {data.completed.includes(l.id)
                    ? t.lessonCompleted
                    : t.openLesson}
                </small>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="notice">{t.noPublishedLessons}</p>
      )}
    </>
  );
}
