import { createClient } from "../client";
import type { DbError } from "../../types";
import type { Note } from "../../aluno/types";

export async function insertNote(userId: string, lessonId: string, body: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ user_id: userId, lesson_id: lessonId, body });
  return error;
}

/** Só apaga se a anotação for do próprio usuário. */
export async function deleteNoteOf(userId: string, id: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", userId);
  return error;
}

/** Total de anotações e, com `limit` > 0, as mais recentes (uma única consulta; sem limit só conta). */
export async function loadNotes(userId: string, limit: number): Promise<{ notes: Note[]; count: number }> {
  const supabase = await createClient();
  if (limit > 0) {
    const { data, count } = await supabase
      .from("notes")
      .select("id, body, lesson_id, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return { notes: (data ?? []) as Note[], count: count ?? 0 };
  }
  const { count } = await supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return { notes: [], count: count ?? 0 };
}
