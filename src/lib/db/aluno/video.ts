import { saveVideoPositionOf } from "../supabase/aluno/video";
import type { DbError } from "../types";

/** Guarda onde o aluno parou no vídeo. Tabela ausente (migração 0007 pendente) não é erro. */
export const saveVideoPosition = (userId: string, lessonId: string, seconds: number, total: number): Promise<DbError> =>
  saveVideoPositionOf(userId, lessonId, seconds, total);
