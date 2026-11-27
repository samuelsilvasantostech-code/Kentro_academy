import { insertQuestion, loadUnseenAnswers, markAnswersSeenOf } from "../supabase/aluno/questions";
import type { DbError } from "../types";
import type { UnseenAnswer } from "./types";

export const addQuestion = (userId: string, lessonId: string, body: string): Promise<DbError> => insertQuestion(userId, lessonId, body);
export const markAnswersSeen = (userId: string, lessonId: string): Promise<DbError> => markAnswersSeenOf(userId, lessonId);
export const getUnseenAnswers = (userId: string, limit: number): Promise<UnseenAnswer[]> => loadUnseenAnswers(userId, limit);
