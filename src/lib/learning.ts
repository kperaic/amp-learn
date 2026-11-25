import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";
import type { LessonRow, ModuleRow, Result, VideoInfo } from "./admin-types";

export type LessonSummary = Pick<
  LessonRow,
  "id" | "module_id" | "title" | "sort_order" | "status"
>;
export function moduleProgress(
  lessons: LessonSummary[],
  completedIds: string[],
) {
  const published = lessons.filter((l) => l.status === "published");
  const completed = new Set(completedIds);
  const count = published.filter((l) => completed.has(l.id)).length;
  return {
    total: published.length,
    completed: count,
    percent: published.length
      ? Math.round((count / published.length) * 100)
      : 0,
    next: published.find((l) => !completed.has(l.id))?.id || null,
  };
}
// Only supply a session client and a profile resolved by current_profile, never
// browser claims. RLS is the entitlement boundary, including explicit assignment.
export async function authorizedLesson(
  db: SupabaseClient,
  profile: Profile,
  id: string,
) {
  if (!profile.active) return null;
  const lesson = await db
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lesson.error || !lesson.data) return null;
  const moduleResult = await db
    .from("modules")
    .select("*")
    .eq("id", lesson.data.module_id)
    .maybeSingle();
  if (moduleResult.error || !moduleResult.data) return null;
  if (
    profile.role !== "super_admin" &&
    (lesson.data.status !== "published" || moduleResult.data.status !== "published" || moduleResult.data.archived_at)
  )
    return null;
  return { lesson: lesson.data as LessonRow, module: moduleResult.data as ModuleRow };
}
export async function authorizedAttachment(
  db: SupabaseClient,
  profile: Profile,
  lessonId: string,
  attachmentId: string,
) {
  const resource = await authorizedLesson(db, profile, lessonId);
  if (!resource) return null;
  const attachment = await db
    .from("lesson_attachments")
    .select("storage_path,original_filename")
    .eq("id", attachmentId)
    .eq("lesson_id", lessonId)
    .eq("ready", true)
    .maybeSingle();
  return attachment.error
    ? null
    : (attachment.data as {
        storage_path: string;
        original_filename: string;
      } | null);
}
export async function setLessonCompletion(
  db: SupabaseClient,
  profile: Profile,
  id: string,
  complete: boolean,
) {
  if (profile.role !== "student" || !(await authorizedLesson(db, profile, id)))
    return false;
  // DO NOTHING on conflict needs no UPDATE grant and preserves original date.
  const result = complete
    ? await db
        .from("lesson_progress")
        .upsert(
          { student_id: profile.id, lesson_id: id },
          { onConflict: "student_id,lesson_id", ignoreDuplicates: true },
        )
    : await db
        .from("lesson_progress")
        .delete()
        .eq("student_id", profile.id)
        .eq("lesson_id", id);
  return !result.error;
}

export async function issueLessonPlayback(
  db: SupabaseClient,
  profile: Profile,
  id: string,
  delivery: {
    enabled: boolean;
    inspect: (video: string) => Promise<Result<VideoInfo | null>>;
    sign: (video: string) => { url: string; expiresAt: number };
  },
): Promise<Result<{ url: string; expiresAt: number }>> {
  const resource = await authorizedLesson(db, profile, id);
  if (!resource) return { error: "learningDenied" };
  if (
    !resource.lesson.bunny_video_id ||
    (profile.role !== "super_admin" && !delivery.enabled)
  )
    return { error: "playbackUnavailable" };
  const result = await delivery.inspect(resource.lesson.bunny_video_id);
  if (
    result.error !== undefined ||
    !result.data ||
    result.data.id !== resource.lesson.bunny_video_id
  )
    return { error: "playbackUnavailable" };
  if ([0, 1, 2, 3, 7].includes(result.data.status))
    return { error: "playbackProcessing" };
  if (![4, 8].includes(result.data.status))
    return { error: "playbackUnavailable" };
  return { data: delivery.sign(result.data.id) };
}
