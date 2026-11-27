import { createClient } from "../client";
import type { DbError } from "../../types";
import type { Profile, StudentState } from "../../aluno/types";

/** Perfil, aulas concluídas e tentativas de quiz do aluno, em paralelo. Sempre filtrado pelo id dele. */
export async function loadStudentState(userId: string): Promise<StudentState> {
  const supabase = await createClient();
  const [{ data: profile }, { data: done }, { data: quizzes }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
    supabase.from("quiz_attempts").select("module_id, score, total").eq("user_id", userId),
  ]);
  return {
    profile: profile as Profile,
    doneLessonIds: (done ?? []).map((r) => r.lesson_id as string),
    quizAttempts: (quizzes ?? []) as StudentState["quizAttempts"],
  };
}

export async function updateProfileName(userId: string, name: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
  return error;
}

export async function saveOnboarding(userId: string, trackId: string, experience: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role_track: trackId, experience, last_track_id: trackId }).eq("id", userId);
  return error;
}

/** Guarda a última trilha e aula abertas (a home usa para "continue de onde parou"). */
export async function setLastLesson(userId: string, trackId: string, lessonId: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ last_track_id: trackId, last_lesson_id: lessonId }).eq("id", userId);
  return error;
}
