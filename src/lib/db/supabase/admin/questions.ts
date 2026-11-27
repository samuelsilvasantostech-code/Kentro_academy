import { createClient } from "../client";
import type { DbError } from "../../types";

/** Grava a resposta e zera answer_seen_at (o aluno vê o destaque de nova resposta). */
export async function writeAnswer(id: string, answer: string, answeredBy: string): Promise<{ found: boolean; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_questions")
    .update({ answer, answered_at: new Date().toISOString(), answered_by: answeredBy, answer_seen_at: null })
    .eq("id", id)
    .select("id");
  return { found: !!data?.length, error };
}
