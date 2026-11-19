"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logDbError } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { parseCorrectIndex, parseLessonId, parseQuizOptions, parseUuid, text, type QuizQuestion } from "@/lib/admin/validate";

const MAX_QUESTIONS = 50;

/**
 * Substitui o quiz inteiro de um módulo (atômico, via RPC admin_save_quiz). Nenhuma pergunta só apaga o quiz com confirm_clear=1.
 * FormData: module_id (uuid) e, para cada pergunta i = 0..49:
 *   q{i}_question, q{i}_options (uma opção por linha, 2 a 6), q{i}_correct (índice a partir de 0 entre as linhas
 *   não vazias), q{i}_explanation (opcional), q{i}_lesson (opcional: aula do módulo para o aluno rever; o banco
 *   descarta se a aula não for deste módulo). Pergunta com os quatro primeiros campos vazios é ignorada.
 * Erros por campo usam as mesmas chaves (ex.: q2_options).
 */
export async function saveQuiz(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const f = fields();
  const moduleId = f.get("module_id", parseUuid(form.get("module_id")));
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < MAX_QUESTIONS; i++) {
    const keys = ["question", "options", "correct", "explanation"].map((k) => `q${i}_${k}`);
    if (keys.every((k) => !String(form.get(k) ?? "").trim())) continue;
    const question = f.get(keys[0], text(form.get(keys[0]), { min: 3, max: 500 }));
    const options = f.get(keys[1], parseQuizOptions(form.get(keys[1])));
    const correct = options ? f.get(keys[2], parseCorrectIndex(form.get(keys[2]), options.length)) : undefined;
    const explanation = f.get(keys[3], text(form.get(keys[3]), { max: 1000 }));
    const rawLesson = String(form.get(`q${i}_lesson`) ?? "").trim();
    const lesson = rawLesson ? f.get(`q${i}_lesson`, parseLessonId(rawLesson)) : null;
    if (question !== undefined && options && correct !== undefined && explanation !== undefined && lesson !== undefined)
      questions.push({ question, options, correct, explanation: explanation || null, lesson_id: lesson });
  }
  if (f.failed) return fail("Confira as perguntas destacadas.", form, f.errors);
  // Lista vazia apaga o quiz: só com confirmação explícita (campo confirm_clear=1).
  if (!questions.length && String(form.get("confirm_clear") ?? "") !== "1") return fail("Adicione ao menos uma pergunta.", form);

  const { error } = await supabase.rpc("admin_save_quiz", { p_module: moduleId, p_questions: questions });
  if (error) {
    logDbError("saveQuiz", error);
    return fail(error.code === "P0002" ? "Módulo não encontrado." : GENERIC_ERROR, form);
  }
  revalidatePath("/", "layout");
  return done(questions.length ? `Quiz salvo (${questions.length} perguntas).` : "Quiz removido.", moduleId);
}
