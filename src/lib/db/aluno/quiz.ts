import * as sb from "../supabase/aluno/quiz";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import { isPostgres } from "../backend";
import type { DbError } from "../types";
import type { QuizForStudent, QuizResult } from "./types";

const { countModuleQuizQuestions, countQuizQuestionsByModule, loadQuizForStudent } = pick(
  { countModuleQuizQuestions: sb.countModuleQuizQuestions, countQuizQuestionsByModule: sb.countQuizQuestionsByModule, loadQuizForStudent: sb.loadQuizForStudent },
  pg,
);

/** Perguntas e opções do módulo, sem gabarito. */
export const getQuizForStudent = (moduleId: string): Promise<QuizForStudent> => loadQuizForStudent(moduleId);

/** Número de perguntas por módulo (só quem tem quiz aparece no mapa). */
export const getQuizCounts = (moduleIds: string[]): Promise<Map<string, number>> => countQuizQuestionsByModule(moduleIds);

export const countQuizQuestions = (moduleId: string): Promise<number> => countModuleQuizQuestions(moduleId);

/**
 * Corrige no banco (submit_quiz). Sem aprovação o aluno só recebe acerto/erro por questão: mesmo que o banco
 * devolvesse mais, o gabarito e as explicações são removidos aqui. Só passa quando `passed` é true.
 */
export async function submitQuiz(userId: string, moduleId: string, answers: number[]): Promise<{ result: QuizResult | null; error: DbError }> {
  const { data, error } = isPostgres() ? await pg.submitQuizAnswersFor(userId, moduleId, answers) : await sb.submitQuizAnswers(moduleId, answers);
  if (error || !data) return { result: null, error };
  const r = data as QuizResult;
  const safe: QuizResult = { score: r.score, total: r.total, passed: r.passed, results: r.results };
  if (r.passed) {
    safe.correct = r.correct;
    safe.explanations = r.explanations;
  }
  return { result: safe, error: null };
}
