"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appUrl, requireProfile } from "@/lib/auth";
import { localeOf } from "@/lib/i18n";
import { homeFor } from "@/lib/access";
import type { Locale, Profile } from "@/lib/types";
const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});
export async function login(locale: Locale, form: FormData) {
  localeOf(locale);
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/login?message=invalid`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/${locale}/login?message=authError`);
  const { data: profile } = await supabase
    .rpc("current_profile")
    .maybeSingle<Profile>();
  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(`/${locale}/login?message=accessDenied`);
  }
  redirect(homeFor(profile, profile.language));
}
export async function logout(locale: Locale) {
  localeOf(locale);
  await (await createClient()).auth.signOut({ scope: "local" });
  redirect(`/${locale}/login`);
}
export async function forgotPassword(locale: Locale, form: FormData) {
  localeOf(locale);
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) redirect(`/${locale}/forgot-password?message=invalid`);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appUrl()}/auth/confirm?locale=${locale}`,
  });
  // Identical response for existing/unknown accounts; provider rate limits apply.
  redirect(`/${locale}/forgot-password?message=recoverySent`);
}
export async function setPassword(locale: Locale, form: FormData) {
  localeOf(locale);
  const password = z.string().min(12).max(128).safeParse(form.get("password"));
  if (!password.success) redirect(`/${locale}/set-password?message=invalid`);
  if (password.data !== form.get("confirmPassword"))
    redirect(`/${locale}/set-password?message=passwordMismatch`);
  const { supabase } = await requireProfile(locale);
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect(`/${locale}/set-password?message=failed`);
  await supabase.auth.signOut({ scope: "global" });
  redirect(`/${locale}/login?message=passwordSaved`);
}
