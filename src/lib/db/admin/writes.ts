// Escritas do /admin. Cada função exige a prova de admin (AdminSession) como primeiro parâmetro.
// adminFn escolhe Supabase ou Postgres do Doca (DATA_BACKEND) a cada chamada.
import * as lessons from "../supabase/admin/lessons";
import * as modules from "../supabase/admin/modules";
import * as news from "../supabase/admin/news";
import * as questions from "../supabase/admin/questions";
import * as quizzes from "../supabase/admin/quizzes";
import * as tracks from "../supabase/admin/tracks";
import * as pg from "../pg/admin";
import { adminFn } from "./guard";

// Aulas
export const findLessonByYoutube = adminFn(lessons.findLessonByYoutubeId, pg.findLessonByYoutubeId);
export const saveLesson = adminFn(lessons.saveLessonRpc, pg.saveLessonRpc);
export const saveLessonKeyPoints = adminFn(lessons.setLessonKeyPoints, pg.setLessonKeyPoints);
export const saveLessonText = adminFn(lessons.writeLessonText, pg.writeLessonText);
export const saveLessonTranscript = adminFn(lessons.writeLessonTranscript, pg.writeLessonTranscript);
export const setLessonPublished = adminFn(lessons.setPublished, pg.setPublished);
export const deleteLesson = adminFn(lessons.removeLesson, pg.removeLesson);
export const linkLesson = adminFn(lessons.linkLessonToModule, pg.linkLessonToModule);
export const unlinkLesson = adminFn(lessons.unlinkLessonFromModule, pg.unlinkLessonFromModule);
export const getModuleLessonIds = adminFn(lessons.listModuleLessonIds, pg.listModuleLessonIds);
export const reorderLessonsInModule = adminFn(lessons.reorderModuleLessons, pg.reorderModuleLessons);

// Módulos
export const renameModule = adminFn(modules.renameModule, pg.renameModule);
export const createModule = adminFn(modules.insertModule, pg.insertModule);
export const deleteModule = adminFn(modules.removeModule, pg.removeModule);
export const getTrackIdOfModule = adminFn(modules.getModuleTrackId, pg.getModuleTrackId);
export const getTrackModuleIds = adminFn(modules.listTrackModuleIds, pg.listTrackModuleIds);
export const reorderModules = adminFn(modules.reorderModules, pg.reorderModules);

// Novidades
export const updateNews = adminFn(news.updateNewsRow, pg.updateNewsRow);
export const createNews = adminFn(news.insertNews, pg.insertNews);
export const deleteNews = adminFn(news.removeNews, pg.removeNews);
export const getNewsIds = adminFn(news.listNewsIds, pg.listNewsIds);
export const reorderNews = adminFn(news.reorderNews, pg.reorderNews);

// Dúvidas
export const answerQuestionRow = adminFn(questions.writeAnswer, pg.writeAnswer);

// Quizzes
export const saveQuiz = adminFn(quizzes.replaceQuiz, pg.replaceQuiz);

// Trilhas
export const updateTrack = adminFn(tracks.updateTrackRow, pg.updateTrackRow);
export const createTrack = adminFn(tracks.insertTrack, pg.insertTrack);
export const deleteTrack = adminFn(tracks.removeTrack, pg.removeTrack);
export const getTrackIds = adminFn(tracks.listTrackIds, pg.listTrackIds);
export const reorderTracks = adminFn(tracks.reorderTracks, pg.reorderTracks);
