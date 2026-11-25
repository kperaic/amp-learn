"use server";
import { z } from "zod";
import { provisionInvitation } from "@/lib/invitation";
import { revalidatePath } from "next/cache";
import { requireAdmin, appUrl } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { localeOf } from "@/lib/i18n";
import { selection, uuid } from "@/lib/admin-validation";
import type { Locale } from "@/lib/types";
import type { Result, StudentRow } from "@/lib/admin-types";
export async function inviteStudent(
  locale: Locale,
  form: FormData,
): Promise<Result<{ id: string; existing: boolean }>> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  const p = z
    .object({
      email: z.email().transform((v) => v.toLowerCase().trim()),
      first_name: z.string().trim().min(1).max(100),
      last_name: z.string().trim().min(1).max(100),
    })
    .safeParse(Object.fromEntries(form));
  const selected = selection.safeParse(form.getAll("modules"));
  if (!p.success || !selected.success) return { error: "invalidFields" };
  // Validate selected modules before sending any email.
  const mods = await supabase
    .from("modules")
    .select("id", { count: "exact", head: true })
    .in("id", selected.data);
  if (mods.error || mods.count !== selected.data.length)
    return { error: "invalidFields" };
  const result = await provisionInvitation({
    lookup: async () => {
      const lookup = await supabase.rpc("admin_find_account", {
        target_email: p.data.email,
      });
      return lookup.error
        ? { error: "setupNeeded" }
        : { data: lookup.data?.[0] || null };
    },
    invite: async () => {
      const admin = createAdminClient();
      if (!admin) return { error: "adminSetup" };
      const { data, error } = await admin.auth.admin.inviteUserByEmail(
        p.data.email,
        {
          redirectTo: `${appUrl()}/auth/confirm?locale=${locale}`,
        },
      );
      return error || !data.user
        ? { error: "inviteFailed" }
        : { data: data.user.id };
    },
    provision: async (id) => {
      const { error } = await supabase.rpc("admin_provision_student", {
        target: id,
        given_name: p.data.first_name,
        family_name: p.data.last_name,
        target_language: locale,
        selected: selected.data,
      });
      return error ? { error: "provisionFailed" } : { data: undefined };
    },
  });
  if (result.error === undefined) revalidatePath(`/${locale}/admin`, "layout");
  return result;
}
export async function resendInvitation(
  locale: Locale,
  id: string,
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success) return { error: "invalidFields" };
  const rows = await supabase
    .rpc("admin_student_directory")
    .eq("id", id)
    .maybeSingle<StudentRow>();
  if (rows.error) return { error: "failed" };
  const student = rows.data;
  if (!student || !student.active) return { error: "invalidAccount" };
  if (student.confirmed_at) return { error: "alreadyConfirmed" };
  const admin = createAdminClient();
  if (!admin) return { error: "adminSetup" };
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    student.email,
    { redirectTo: `${appUrl()}/auth/confirm?locale=${student.language}` },
  );
  // Provider may reject an already invited address. Never create a replacement identity.
  if (error || data.user?.id !== id) return { error: "resendFailed" };
  return { data: undefined };
}
export async function sendStudentRecovery(
  locale: Locale,
  id: string,
): Promise<Result> {
  localeOf(locale);
  const { supabase } = await requireAdmin(locale);
  if (!uuid.safeParse(id).success) return { error: "invalidFields" };
  const rows = await supabase
    .rpc("admin_student_directory")
    .eq("id", id)
    .maybeSingle<StudentRow>();
  if (rows.error) return { error: "failed" };
  const student = rows.data;
  if (!student || !student.active) return { error: "invalidAccount" };
  const { error } = await supabase.auth.resetPasswordForEmail(student.email, {
    redirectTo: `${appUrl()}/auth/confirm?locale=${student.language}`,
  });
  return error ? { error: "failed" } : { data: undefined };
}
