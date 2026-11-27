import { createClient } from "../client";
import type { DbError } from "../../types";

export async function listDoneLessonIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId);
  return (data ?? []).map((r) => r.lesson_id as string);
}

export async function insertLessonDone(userId: string, lessonId: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").insert({ user_id: userId, lesson_id: lessonId });
  return error;
}

export async function deleteLessonDone(userId: string, lessonId: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
  return error;
}
