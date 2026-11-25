import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { uuid } from "@/lib/admin-validation";
import { authorizedLesson, moduleProgress } from "@/lib/learning";
import { moduleData } from "@/lib/learning-data";
import { readAll } from "@/lib/read-all";
import { LessonDocument } from "@/components/learn/document";
import { LearningProgress } from "@/components/learn/progress";
import { Completion, Download, VideoPlayer } from "@/components/learn/controls";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params,
    locale = localeOf(raw),
    t = messages(locale),
    context = await requireProfile(locale);
  if (!uuid.safeParse(id).success) notFound();
  const resource = await authorizedLesson(
    context.supabase,
    context.profile,
    id,
  );
  if (!resource) notFound();
  const data = await moduleData(locale, resource.module.id),
    lesson = resource.lesson;
  const attachments = await readAll((from, to) =>
    context.supabase
      .from("lesson_attachments")
      .select("id,original_filename,mime_type,file_size_bytes")
      .eq("lesson_id", id)
      .eq("ready", true)
      .order("sort_order")
      .order("id")
      .range(from, to),
  );
  if (attachments.error) throw Error("Attachments unavailable");
  const index = data.lessons.findIndex((l) => l.id === id),
    prev = data.lessons[index - 1],
    next = data.lessons[index + 1],
    p = moduleProgress(data.lessons, data.completed);
  return (
    <>
      <Link className="button secondary learning-back" href={`/${locale}/learn`}>
        <span aria-hidden="true">←</span> {t.myModules}
      </Link>
      {data.admin && (
        <p className="notice">
          {t.adminPreview} ·{" "}
          <Link href={`/${locale}/admin/lessons/${id}`}>{t.edit}</Link>
        </p>
      )}
      <div className="lesson-layout">
        <aside className="lesson-navigation">
          <details open>
            <summary>{t.lessonNavigation}</summary>
            <h2>
              <Link href={`/${locale}/learn/modules/${data.module.id}`}>
                {data.module.title}
              </Link>
            </h2>
            <LearningProgress locale={locale} {...p} />
            <nav aria-label={t.lessons}>
              <ol>
                {data.lessons.map((l, i) => (
                  <li key={l.id}>
                    <Link
                      href={`/${locale}/learn/lessons/${l.id}`}
                      aria-current={l.id === id ? "page" : undefined}
                    >
                      <span>{data.completed.includes(l.id) ? "✓" : i + 1}</span>
                      <span>
                        {l.title}
                        {l.status === "draft" && <small> · {t.draft}</small>}
                      </span>
                      {data.completed.includes(l.id) && (
                        <span className="sr-only">{t.lessonCompleted}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </details>
        </aside>
        <article className="lesson-main">
          <h1>{lesson.title}</h1>
          {lesson.bunny_video_id && (
            <VideoPlayer
              key={`video-${id}`}
              locale={locale}
              lesson={id}
              title={lesson.title}
            />
          )}
          <LessonDocument
            content={lesson.content}
            invalidMessage={t.contentUnavailable}
            heading={t.aboutLesson}
          />
          {attachments.data.length > 0 && (
            <section className="lesson-materials">
              <h2>{t.attachments}</h2>
              <ul>
                {attachments.data.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{a.original_filename}</strong>
                      <small>
                        {a.original_filename.split(".").pop()?.toUpperCase()} ·{" "}
                        {new Intl.NumberFormat(locale, {
                          style: "unit",
                          unit: a.file_size_bytes < 1000
                            ? "byte"
                            : a.file_size_bytes < 1_000_000 ? "kilobyte" : "megabyte",
                          maximumFractionDigits: 2,
                        }).format(a.file_size_bytes / (a.file_size_bytes < 1000
                          ? 1
                          : a.file_size_bytes < 1_000_000 ? 1000 : 1_000_000))}
                      </small>
                    </div>
                    <Download locale={locale} lesson={id} attachment={a.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <footer className="lesson-footer">
            {!data.admin && (
              <Completion
                key={`completion-${id}-${data.completed.includes(id)}`}
                locale={locale}
                lesson={id}
                completed={data.completed.includes(id)}
              />
            )}
            <nav className="lesson-paging" aria-label={t.lessonNavigation}>
              {prev && (
                <Link className="lesson-previous" href={`/${locale}/learn/lessons/${prev.id}`}>
                  <span aria-hidden="true">←</span>
                  <span>{t.previousLesson}<small>{prev.title}</small></span>
                </Link>
              )}
              {next ? (
                <Link className="button lesson-next" href={`/${locale}/learn/lessons/${next.id}`}>
                  <span>{t.nextLesson}<small>{next.title}</small></span>
                  <span className="lesson-next-arrow" aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link className="button lesson-next" href={`/${locale}/learn/modules/${data.module.id}`}>
                  <span>{t.backToModule}<small>{data.module.title}</small></span>
                  <span className="lesson-next-arrow" aria-hidden="true">→</span>
                </Link>
              )}
            </nav>
          </footer>
        </article>
      </div>
    </>
  );
}
