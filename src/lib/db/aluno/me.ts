import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUserFast } from "../auth";
import * as sb from "../supabase/aluno/me";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import type { DbError } from "../types";
import type { Me } from "./types";

const { loadStudentState, saveOnboarding, setLastLesson, updateProfileName } = pick(sb, pg);

/**
 * Usuário logado, perfil e progresso. Sem sessão, vai para /entrar.
 * A sessão é validada localmente (assinatura assimétrica), sem ida ao Auth. As actions que gravam
 * usam getSessionUser, que também detecta sessão revogada.
 */
export const getMe = cache(async (): Promise<Me> => {
  const user = await getSessionUserFast();
  if (!user) redirect("/entrar");
  const { profile, doneLessonIds, quizAttempts } = await loadStudentState(user.id);
  return {
    user,
    profile,
    done: new Set(doneLessonIds),
    quizDone: new Set(quizAttempts.map((r) => r.module_id)),
    quizPassed: new Set(quizAttempts.filter((r) => r.total > 0 && r.score * 100 >= 70 * r.total).map((r) => r.module_id)),
  };
});

/** O aluno corrige o próprio nome (é o nome que sai no certificado). */
export const updateName = (userId: string, name: string): Promise<DbError> => updateProfileName(userId, name);
/** Guarda a trilha escolhida e a experiência informada no primeiro acesso. */
export const finishOnboardingFor = (userId: string, trackId: string, experience: string): Promise<DbError> => saveOnboarding(userId, trackId, experience);
/** Guarda a última trilha e aula abertas (a home usa para continuar de onde parou). */
export const recordLastLesson = (userId: string, trackId: string, lessonId: string): Promise<DbError> => setLastLesson(userId, trackId, lessonId);
