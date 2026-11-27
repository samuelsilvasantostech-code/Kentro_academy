import { createClient } from "../client";
import type { DbError } from "../../types";

/**
 * Guarda onde o aluno parou no vídeo (tabela da migração 0007). Perto do início ou do fim apaga, para recomeçar
 * do zero. Tabela ausente (migração pendente) não é erro: devolve null e a retomada fica só no navegador.
 */
export async function saveVideoPositionOf(userId: string, lessonId: string, seconds: number, total: number): Promise<DbError> {
  const supabase = await createClient();
  const s = Math.floor(seconds);
  const { error } = s < 10 || (total > 0 && s > total - 20)
    ? await supabase.from("video_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId)
    : await supabase.from("video_progress").upsert({ user_id: userId, lesson_id: lessonId, seconds: Math.min(s, 86400), updated_at: new Date().toISOString() });
  // 42P01/PGRST205: tabela ainda não existe (migração 0007 pendente). Não é erro do aluno.
  if (error && error.code !== "42P01" && error.code !== "PGRST205") return error;
  return null;
}
