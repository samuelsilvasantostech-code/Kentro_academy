import { createClient } from "../client";
import type { DbError } from "../../types";
import type { QuizQuestion } from "@/lib/admin/validate";

/** Substitui o quiz inteiro do módulo de forma atômica (RPC admin_save_quiz). */
export async function replaceQuiz(moduleId: string, questions: QuizQuestion[]): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_quiz", { p_module: moduleId, p_questions: questions });
  return error;
}
