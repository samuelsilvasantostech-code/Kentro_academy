import * as sb from "../supabase/aluno/lesson";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import type { LessonPage } from "./types";

const { loadLessonPage } = pick(sb, pg);

/**
 * Dados da página da aula. `preview` só para o admin vendo como aluno (lê também rascunho);
 * para o aluno só vem o que está publicado.
 */
export const getLessonPage = (args: { userId: string; lessonId: string; moduleIds: string[]; preview: boolean }): Promise<LessonPage> => loadLessonPage(args);
