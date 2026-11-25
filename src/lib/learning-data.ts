import "server-only";
import { notFound } from "next/navigation";
import { requireProfile } from "./auth";
import { readAll } from "./read-all";
import { uuid } from "./admin-validation";
import type { Locale } from "./types";
import type { ModuleRow } from "./admin-types";
import type { LessonSummary } from "./learning";
export async function moduleData(locale: Locale, id: string) {
  const context = await requireProfile(locale);
  if (!uuid.safeParse(id).success) notFound();
  const { data: module, error } = await context.supabase
    .from("modules")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw Error("Content unavailable");
  if (!module) notFound();
  const admin = context.profile.role === "super_admin";
  const [lessons, progress] = await Promise.all([
    readAll((from, to) => {
      let query = context.supabase
        .from("lessons")
        .select("id,module_id,title,status,sort_order")
        .eq("module_id", id);
      if (!admin) query = query.eq("status", "published");
      return query.order("sort_order").order("id").range(from, to);
    }),
    readAll((from, to) =>
      context.supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", context.profile.id)
        .order("lesson_id")
        .range(from, to),
    ),
  ]);
  if (lessons.error || progress.error) throw Error("Content unavailable");
  return {
    ...context,
    admin,
    module: module as ModuleRow,
    lessons: lessons.data as LessonSummary[],
    completed: progress.data.map((p) => p.lesson_id as string),
  };
}
