"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { localeOf } from "@/lib/i18n";
import { uuid } from "@/lib/admin-validation";
import type { Locale } from "@/lib/types";
import type { Result, StudentRow } from "@/lib/admin-types";

// Bounded and repeatable: failed removals remain queued for the archive's retry button.
export async function cleanupDeletedFiles(locale: Locale): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const { data, error } = await supabase.from("file_deletion_queue")
    .select("bucket,path").order("bucket").order("path").limit(100);
  if (error) return { error: "cleanupPending" };
  for (const bucket of ["module-covers", "lesson-attachments"]) {
    const paths = data.filter((item) => item.bucket === bucket).map((item) => item.path);
    if (!paths.length) continue;
    const removed = await supabase.storage.from(bucket).remove(paths);
    if (removed.error) continue;
    await supabase.from("file_deletion_queue").delete().eq("bucket", bucket).in("path", paths);
  }
  const remaining = await supabase.from("file_deletion_queue").select("path", { count: "exact", head: true });
  revalidatePath(`/${locale}/admin/modules`, "page");
  return remaining.error || remaining.count ? { error: "cleanupPending" } : { data: undefined };
}

export async function deleteArchivedModule(locale: Locale, id: string, confirmation: string): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success || typeof confirmation !== "string" || !confirmation || confirmation.length > 200)
    return { error: "invalidFields" };
  const { error } = await supabase.rpc("admin_delete_archived_module", { target: id, confirmation });
  if (error) return { error: "deleteFailed" };
  // Content deletion has committed. Cleanup failure must not be reported as a failed deletion.
  try { await cleanupDeletedFiles(locale); } catch { /* Durable queue allows retry. */ }
  revalidatePath(`/${locale}/admin`, "layout");
  revalidatePath(`/${locale}/learn`, "layout");
  return { data: undefined };
}

export async function deleteInactiveStudent(locale: Locale, id: string, confirmation: string): Promise<Result> {
  localeOf(locale);
  const { supabase, user } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success || id === user.id || typeof confirmation !== "string")
    return { error: "invalidFields" };
  const row = await supabase.rpc("admin_student_directory").eq("id", id).maybeSingle<StudentRow>();
  if (row.error || !row.data || row.data.active || confirmation !== row.data.email)
    return { error: "deleteFailed" };
  const admin = createAdminClient();
  if (!admin) return { error: "adminSetup" };
  // Hard deletion through the supported Auth API. The DB trigger also rejects a
  // concurrently reactivated account; cascades remove profile/access/progress together.
  const { error } = await admin.auth.admin.deleteUser(id, false);
  if (error) return { error: "deleteFailed" };
  revalidatePath(`/${locale}/admin`, "layout");
  return { data: undefined };
}
