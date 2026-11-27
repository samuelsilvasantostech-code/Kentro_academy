import { deleteLessonDone, insertLessonDone, listDoneLessonIds } from "../supabase/aluno/progress";
import type { DbError } from "../types";

export const getDoneLessonIds = (userId: string): Promise<Set<string>> => listDoneLessonIds(userId).then((ids) => new Set(ids));
export const markLessonDone = (userId: string, lessonId: string): Promise<DbError> => insertLessonDone(userId, lessonId);
export const unmarkLessonDone = (userId: string, lessonId: string): Promise<DbError> => deleteLessonDone(userId, lessonId);
