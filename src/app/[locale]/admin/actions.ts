"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { localeOf } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import {
  uuid,
  moduleInput,
  selection,
  studentInput,
  fileInput,
  parseBunnyVideo,
} from "@/lib/admin-validation";
import { validateLessonDocument } from "@/lib/lesson-document";
import { inspectVideo } from "@/lib/bunny";
import type { Result, VideoInfo } from "@/lib/admin-types";
import { z } from "zod";
function refresh(locale: Locale) {
  revalidatePath(`/${locale}/admin`, "layout");
}
export async function saveModule(
  locale: Locale,
  id: string | null,
  input: unknown,
): Promise<Result<{ id: string; updated_at: string }>> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const p = moduleInput.safeParse(input);
  if (!p.success || (id !== null && (!uuid.safeParse(id).success || !p.data.version)))
    return { error: "invalidFields" };
  const { version, ...fields } = p.data;
  const query = id
    ? supabase.from("modules").update(fields).eq("id", id).eq("updated_at", version!)
    : supabase
        .from("modules")
        .insert({ ...fields, sort_order: Math.floor(Date.now() / 1000) });
  const { data, error } = await query.select("id,updated_at").maybeSingle();
  if (error) return { error: "failed" };
  if (!data) return { error: "saveConflict" };
  refresh(locale);
  return { data };
}
export async function createLesson(
  locale: Locale,
  module: string,
  title: string,
): Promise<Result<string>> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (
    !uuid.safeParse(module).success ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 200
  )
    return { error: "invalidFields" };
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      module_id: module,
      title: title.trim(),
      sort_order: Math.floor(Date.now() / 1000),
    })
    .select("id")
    .single();
  if (error) return { error: "failed" };
  refresh(locale);
  return { data: data.id };
}
export async function reorder(
  locale: Locale,
  kind: "modules" | "lessons",
  parent: string | null,
  ids: string[],
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (
    !["modules", "lessons"].includes(kind) ||
    (parent && !uuid.safeParse(parent).success) ||
    !z.array(uuid).max(10000).safeParse(ids).success
  )
    return { error: "invalidFields" };
  const { error } = await supabase.rpc("admin_reorder", {
    kind,
    parent,
    ordered_ids: ids,
  });
  if (error) return { error: "orderConflict" };
  refresh(locale);
  return { data: undefined };
}
export async function checkVideo(
  locale: Locale,
  value: string,
): Promise<Result<VideoInfo | null>> {
  localeOf(locale);
  await requireAdmin(locale);
  if (typeof value !== "string" || value.length > 2000)
    return { error: "invalidVideo" };
  return inspectVideo(value);
}
export async function saveLesson(
  locale: Locale,
  id: string,
  input: unknown,
): Promise<Result<{ updated_at: string }>> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(200),
      status: z.enum(["draft", "published"]),
      video: z.string().max(2000),
      content: z.unknown(),
      version: z.string(),
    })
    .safeParse(input);
  if (!uuid.safeParse(id).success || !parsed.success)
    return { error: "invalidFields" };
  const p = parsed.data,
    document = validateLessonDocument(p.content);
  if (document.error) return { error: document.error };
  const content = document.data;
  const old = await supabase
    .from("lessons")
    .select("bunny_video_id")
    .eq("id", id)
    .single();
  if (old.error) return { error: "failed" };
  let video: string | null;
  try {
    video = parseBunnyVideo(
      p.video,
      process.env.BUNNY_STREAM_LIBRARY_ID || "820051",
    );
  } catch {
    return { error: "invalidVideo" };
  }
  // Existing association does not block text edits during a Bunny outage.
  if (video && video !== old.data.bunny_video_id) {
    const checked = await inspectVideo(video);
    if (checked.error) return { error: checked.error };
  }
  const { data, error } = await supabase
    .from("lessons")
    .update({
      title: p.title,
      status: p.status,
      content,
      bunny_video_id: video,
    })
    .eq("id", id)
    .eq("updated_at", p.version)
    .select("updated_at")
    .maybeSingle();
  if (error) return { error: "failed" };
  if (!data) return { error: "saveConflict" };
  refresh(locale);
  return { data };
}
export async function saveStudent(
  locale: Locale,
  id: string,
  input: unknown,
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const p = studentInput.safeParse(input);
  if (!p.success || !uuid.safeParse(id).success)
    return { error: "invalidFields" };
  const { error } = await supabase.rpc("admin_update_student", {
    target: id,
    given_name: p.data.first_name,
    family_name: p.data.last_name,
    target_language: p.data.language,
    target_active: p.data.active,
  });
  if (error) return { error: "failed" };
  refresh(locale);
  return { data: undefined };
}
export async function saveAccess(
  locale: Locale,
  id: string,
  ids: string[],
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const p = selection.safeParse(ids);
  if (!p.success || !uuid.safeParse(id).success)
    return { error: "invalidFields" };
  const { error } = await supabase.rpc("admin_set_access", {
    target: id,
    selected: p.data,
    additive: false,
  });
  if (error) return { error: "failed" };
  refresh(locale);
  return { data: undefined };
}
export async function reserveAttachment(
  locale: Locale,
  lesson: string,
  input: unknown,
): Promise<Result<{ id: string; path: string }>> {
  localeOf(locale);
  const { supabase, profile } = await requireAdmin(locale);
  const p = fileInput.safeParse(input);
  if (!p.success || !uuid.safeParse(lesson).success)
    return { error: "fileLimit" };
  const limit = await supabase.rpc("admin_upload_limit", {
    bucket: "lesson-attachments",
  });
  if (limit.error) return { error: "setupNeeded" };
  if (p.data.size > Number(limit.data)) return { error: "fileLimit" };
  const id = crypto.randomUUID(),
    path = `${lesson}/${id}/${p.data.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_")}`;
  const { error } = await supabase.from("lesson_attachments").insert({
    id,
    lesson_id: lesson,
    storage_path: path,
    original_filename: p.data.name,
    mime_type: p.data.type,
    file_size_bytes: p.data.size,
    uploaded_by: profile.id,
  });
  return error ? { error: "failed" } : { data: { id, path } };
}
export async function finishAttachment(
  locale: Locale,
  id: string,
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success) return { error: "invalidFields" };
  const { error } = await supabase.rpc("admin_finish_attachment", {
    target: id,
  });
  if (error) return { error: "uploadMismatch" };
  refresh(locale);
  return { data: undefined };
}
export async function removeAttachment(
  locale: Locale,
  id: string,
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success) return { error: "invalidFields" };
  const { data, error } = await supabase
    .from("lesson_attachments")
    .update({ ready: false })
    .eq("id", id)
    .select("storage_path")
    .single();
  if (error) return { error: "failed" };
  const removed = await supabase.storage
    .from("lesson-attachments")
    .remove([data.storage_path]);
  if (removed.error) {
    refresh(locale);
    return { error: "removeFailed" };
  }
  const deleted = await supabase
    .from("lesson_attachments")
    .delete()
    .eq("id", id);
  refresh(locale);
  return deleted.error ? { error: "removeFailed" } : { data: undefined };
}
export async function downloadAttachment(
  locale: Locale,
  id: string,
): Promise<Result<string>> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success) return { error: "invalidFields" };
  const { data, error } = await supabase
    .from("lesson_attachments")
    .select("storage_path,original_filename")
    .eq("id", id)
    .eq("ready", true)
    .single();
  if (error) return { error: "failed" };
  const signed = await supabase.storage
    .from("lesson-attachments")
    .createSignedUrl(data.storage_path, 300, {
      download: data.original_filename,
    });
  return signed.error ? { error: "failed" } : { data: signed.data.signedUrl };
}
export async function prepareCover(
  locale: Locale,
  id: string,
  input: unknown,
): Promise<Result<string>> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const p = fileInput.safeParse(input);
  if (
    !uuid.safeParse(id).success ||
    !p.success ||
    !["image/jpeg", "image/png", "image/webp"].includes(p.data.type)
  )
    return { error: "invalidImage" };
  const limit = await supabase.rpc("admin_upload_limit", {
    bucket: "module-covers",
  });
  if (limit.error) return { error: "setupNeeded" };
  if (p.data.size > Number(limit.data)) return { error: "fileLimit" };
  const exists = await supabase
    .from("modules")
    .select("id")
    .eq("id", id)
    .single();
  if (exists.error) return { error: "failed" };
  return {
    data: `${id}/${crypto.randomUUID()}.${p.data.name.split(".").pop()?.toLowerCase()}`,
  };
}
export async function finishCover(
  locale: Locale,
  id: string,
  path: string,
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success || typeof path !== "string" || path.length > 500)
    return { error: "invalidFields" };
  const { error } = await supabase.rpc("admin_set_cover", {
    target: id,
    object_path: path,
  });
  if (error) return { error: "uploadMismatch" };
  refresh(locale);
  return { data: undefined };
}

export async function setModuleArchived(locale: Locale, id: string, archived: boolean): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success || typeof archived !== "boolean") return { error: "invalidFields" };
  const { data, error } = await supabase.from("modules")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id).select("id").maybeSingle();
  if (error || !data) return { error: "failed" };
  revalidatePath(`/${locale}/admin`, "layout");
  revalidatePath(`/${locale}/learn`, "layout");
  return { data: undefined };
}
