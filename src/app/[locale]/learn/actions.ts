"use server";
import { requireProfile } from "@/lib/auth";
import { localeOf } from "@/lib/i18n";
import { uuid } from "@/lib/admin-validation";
import { setLessonCompletion } from "@/lib/learning";
import { revalidatePath } from "next/cache";
import type { Locale } from "@/lib/types";
export async function completeLesson(
  locale: Locale,
  id: string,
  complete: boolean,
) {
  localeOf(locale);
  const { supabase, profile } = await requireProfile(locale);
  if (!uuid.safeParse(id).success || typeof complete !== "boolean")
    return { error: "learningDenied" };
  if (!(await setLessonCompletion(supabase, profile, id, complete)))
    return { error: "learningDenied" };
  revalidatePath(`/${locale}/learn`, "layout");
  return { complete };
}
