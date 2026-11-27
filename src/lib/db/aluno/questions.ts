import * as sb from "../supabase/aluno/questions";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";

const { insertQuestion, loadUnseenAnswers, markAnswersSeenOf } = pick(sb, pg);
import type { DbError } from "../types";
import type { UnseenAnswer } from "./types";

export const addQuestion = (userId: string, lessonId: string, body: string): Promise<DbError> => insertQuestion(userId, lessonId, body);
export const markAnswersSeen = (userId: string, lessonId: string): Promise<DbError> => markAnswersSeenOf(userId, lessonId);
export const getUnseenAnswers = (userId: string, limit: number): Promise<UnseenAnswer[]> => loadUnseenAnswers(userId, limit);
