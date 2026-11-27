import * as sb from "../supabase/aluno/progress";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import type { DbError } from "../types";

const { deleteLessonDone, insertLessonDone, listDoneLessonIds } = pick(sb, pg);

export const getDoneLessonIds = (userId: string): Promise<Set<string>> => listDoneLessonIds(userId).then((ids) => new Set(ids));
export const markLessonDone = (userId: string, lessonId: string): Promise<DbError> => insertLessonDone(userId, lessonId);
export const unmarkLessonDone = (userId: string, lessonId: string): Promise<DbError> => deleteLessonDone(userId, lessonId);
