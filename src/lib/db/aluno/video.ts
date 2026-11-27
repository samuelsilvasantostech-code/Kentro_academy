import * as sb from "../supabase/aluno/video";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import type { DbError } from "../types";

const { saveVideoPositionOf } = pick(sb, pg);

/** Guarda onde o aluno parou no vídeo. Tabela ausente (migração 0007 pendente) não é erro. */
export const saveVideoPosition = (userId: string, lessonId: string, seconds: number, total: number): Promise<DbError> =>
  saveVideoPositionOf(userId, lessonId, seconds, total);
