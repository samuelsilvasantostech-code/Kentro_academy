import { createClient } from "../client";
import type { DbError } from "../../types";
import type { QuizForStudent } from "../../aluno/types";

/**
 * Perguntas do quiz para o aluno. Só colunas sem gabarito (question, options, lesson_id): `correct` e
 * `explanation` nunca são lidos aqui. A correção é feita no banco (submit_quiz).
 */
export async function loadQuizForStudent(moduleId: string): Promise<QuizForStudent> {
  const supabase = await createClient();
  const [{ data: questions }, rv] = await Promise.all([
    supabase.from("quiz_questions").select("question, options").eq("module_id", moduleId).order("position"),
    // Aula indicada para rever cada pergunta (migração 0007; antes dela o erro é ignorado). Não revela o gabarito.
    supabase.from("quiz_questions").select("lesson_id").eq("module_id", moduleId).order("position"),
  ]);
  const list = (questions ?? []) as QuizForStudent["questions"];
  const review = rv.data?.length === list.length ? rv.data.map((r) => (r.lesson_id as string | null) ?? null) : [];
  return { questions: list, review };
}

/** Quantas perguntas cada módulo tem (só a coluna module_id; sem gabarito). */
export async function countQuizQuestionsByModule(moduleIds: string[]): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("quiz_questions").select("module_id").in("module_id", moduleIds);
  const counts = new Map<string, number>();
  (data ?? []).forEach((r) => counts.set(r.module_id as string, (counts.get(r.module_id as string) ?? 0) + 1));
  return counts;
}

export async function countModuleQuizQuestions(moduleId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
  return count ?? 0;
}

/** Corrige no banco (RPC submit_quiz, que grava a tentativa em nome do usuário da sessão). Devolve o JSON cru dele. */
export async function submitQuizAnswers(moduleId: string, answers: number[]): Promise<{ data: unknown; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", { p_module: moduleId, p_answers: answers });
  return { data, error };
}
