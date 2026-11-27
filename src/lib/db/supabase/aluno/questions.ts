import { createClient } from "../client";
import type { DbError } from "../../types";
import type { UnseenAnswer } from "../../aluno/types";

export async function insertQuestion(userId: string, lessonId: string, body: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_questions").insert({ user_id: userId, lesson_id: lessonId, body });
  return error;
}

/**
 * Marca como vistas as respostas do usuário da sessão nesta aula (RPC; o aluno não atualiza a tabela).
 * O filtro por usuário está dentro da função do banco (auth.uid()); `userId` fica na assinatura para as
 * outras implementações filtrarem explicitamente.
 */
export async function markAnswersSeenOf(_userId: string, lessonId: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_answers_seen", { p_lesson: lessonId });
  return error;
}

/** Respostas da equipe que o aluno ainda não viu, as mais recentes primeiro. */
export async function loadUnseenAnswers(userId: string, limit: number): Promise<UnseenAnswer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_questions")
    .select("id, lesson_id, body, answered_at")
    .eq("user_id", userId)
    .not("answer", "is", null)
    .is("answer_seen_at", null)
    .order("answered_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as UnseenAnswer[];
}
