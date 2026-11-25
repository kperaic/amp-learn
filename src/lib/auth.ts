import { trustedOrigin } from "./access";
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Locale, Profile } from "./types";
import { homeFor, mayEnter } from "./access";
export const requireProfile = cache(async (locale: Locale) => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect(`/${locale}/login`);
  const { data: profile, error: profileError } = await supabase
    .rpc("current_profile")
    .maybeSingle<Profile>();
  if (profileError || !profile?.active)
    redirect(`/${locale}/login?message=accessDenied`);
  return { supabase, profile, user };
});
export async function requireAdmin(locale: Locale) {
  const context = await requireProfile(locale);
  if (!mayEnter(context.profile, "admin"))
    redirect(homeFor(context.profile, locale));
  return context;
}
export function appUrl() { return trustedOrigin(process.env.APP_URL); }
