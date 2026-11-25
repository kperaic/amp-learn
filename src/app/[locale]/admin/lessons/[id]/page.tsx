import { PermanentDelete } from "@/components/admin/deletion";
import { readAll } from "@/lib/read-all";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import { uuid } from "@/lib/admin-validation";
import { LessonEditor } from "@/components/admin/lesson-editor";
import { Attachments } from "@/components/admin/attachments";
import type { LessonRow, AttachmentRow } from "@/lib/admin-types";
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
  const [l, a] = await Promise.all([
    supabase.from("lessons").select("*").eq("id", id).maybeSingle(),
    readAll((from, to) =>
      supabase
        .from("lesson_attachments")
        .select("*")
        .eq("lesson_id", id)
        .order("sort_order")
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (l.error || a.error) throw Error("Lesson unavailable");
  if (!l.data) notFound();
  const lesson = l.data as LessonRow;
  return (
    <>
      <Link href={`/${locale}/admin/modules/${lesson.module_id}`}>
        {t.modules} / {t.lessons}
      </Link>
      <h1>{lesson.title}</h1>
      <p>
        <Link
          className="button secondary"
          href={`/${locale}/learn/lessons/${id}`}
        >
          {t.previewLesson}
        </Link>
      </p>
      <LessonEditor key={id} locale={locale} lesson={lesson} />
      <Attachments
        locale={locale}
        lesson={id}
        attachments={a.data as AttachmentRow[]}
      />
      <PermanentDelete locale={locale} kind="lesson" id={id} label={lesson.title} moduleId={lesson.module_id} />
    </>
  );
}
