import { cache } from "react";
import * as sb from "../supabase/admin/queries";
import * as pg from "../pg/admin";
import { adminFn } from "./guard";
import type { AdminSession } from "./session";
import type { AdminQuestion } from "./types";

// Leituras do /admin. Rascunhos e trilhas não publicadas aparecem aqui.
// O cache por pedido vale por prova de admin: use a mesma (a de getAdmin/getAdminOrNotFound) na página inteira.

/** Trilhas > módulos > aulas (com rascunhos), na ordem de exibição, e quantas perguntas cada módulo tem. */
export const getAdminTracks = cache(adminFn(sb.loadAdminTracks, pg.loadAdminTracks));

/** Todas as aulas (publicadas e rascunhos), mais recentes primeiro, com os módulos/trilhas em que estão. */
export const getAdminLessons = cache(adminFn(sb.loadAdminLessons, pg.loadAdminLessons));

/** Uma aula completa para o formulário de edição (use chaptersToText/materialsToText/formatDuration de validate.ts). */
export const getAdminLesson = adminFn(sb.loadAdminLesson, pg.loadAdminLesson);

/** Gabarito completo de um módulo (RPC admin_quiz_questions: a tabela não entrega correct/explanation nem ao admin). */
export const getAdminQuiz = adminFn(sb.loadAdminQuiz, pg.loadAdminQuiz);

/**
 * Dúvidas dos alunos. "pending" = sem resposta, mais antigas primeiro (a fila);
 * "answered" = respondidas, mais recentes primeiro. Até `limit` itens (padrão 50).
 */
export const getQuestions = (admin: AdminSession, status: "pending" | "answered", limit = 50): Promise<AdminQuestion[]> =>
  adminFn(sb.loadQuestions, pg.loadQuestions)(admin, status, limit);

/** Contador da fila de dúvidas (para o menu). */
export const getPendingCount = cache(adminFn(sb.countPendingQuestions, pg.countPendingQuestions));

export const getAdminNews = cache(adminFn(sb.loadAdminNews, pg.loadAdminNews));
