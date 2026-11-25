import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { inspectVideo } from "./bunny";
import { signedEmbed } from "./playback-token";
import { issueLessonPlayback } from "./learning";
import type { Profile, Locale } from "./types";
import type { ModuleRow, Result } from "./admin-types";

export async function deliverySession() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase
    .rpc("current_profile")
    .maybeSingle<Profile>();
  if (profileError || !profile?.active || profile.id !== user.id) return null;
  return { supabase, profile };
}
// React cache is request-scoped; no cross-user content or URL cache.
const coverSession = cache(deliverySession);
export const coverUrl = cache(async (module: ModuleRow) => {
  if (!module.cover_path) return undefined;
  try {
    const context = await coverSession();
    if (!context) return undefined;
    // Resolve the current path again from an authorized record, not a caller path.
    const { data, error } = await context.supabase
      .from("modules")
      .select("cover_path")
      .eq("id", module.id)
      .maybeSingle();
    if (error || !data?.cover_path) return undefined;
    const admin = createAdminClient();
    if (!admin) return undefined;
    const result = await admin.storage
      .from("module-covers")
      .createSignedUrl(data.cover_path, 300);
    return result.data?.signedUrl;
  } catch {
    // A failed optional image must not hide otherwise accessible lessons.
    return undefined;
  }
});
export async function playbackForLesson(
  context: NonNullable<Awaited<ReturnType<typeof deliverySession>>>,
  id: string,
  locale: Locale,
): Promise<Result<{ url: string; expiresAt: number }>> {
  const key = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
  // Fail closed for students until live iframe AND media tests pass.
  return issueLessonPlayback(context.supabase, context.profile, id, {
    enabled: process.env.BUNNY_STREAM_DELIVERY_VERIFIED === "true",
    inspect: async (video) =>
      key ? inspectVideo(video) : { error: "playbackUnavailable" },
    sign: (video) =>
      signedEmbed(
        process.env.BUNNY_STREAM_LIBRARY_ID || "820051",
        video,
        key!,
        locale,
      ),
  });
}
