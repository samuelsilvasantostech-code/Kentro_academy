// Escritas do /admin. Cada função exige a prova de admin (AdminSession) como primeiro parâmetro.
import {
  findLessonByYoutubeId, linkLessonToModule, listModuleLessonIds, removeLesson, reorderModuleLessons, saveLessonRpc,
  setLessonKeyPoints, setPublished, unlinkLessonFromModule, writeLessonText, writeLessonTranscript,
} from "../supabase/admin/lessons";
import { getModuleTrackId, insertModule, listTrackModuleIds, removeModule, renameModule as renameModuleRow, reorderModules as reorderModuleRows } from "../supabase/admin/modules";
import { insertNews, listNewsIds, removeNews, reorderNews as reorderNewsRows, updateNewsRow } from "../supabase/admin/news";
import { writeAnswer } from "../supabase/admin/questions";
import { replaceQuiz } from "../supabase/admin/quizzes";
import { insertTrack, listTrackIds, removeTrack, reorderTracks as reorderTrackRows, updateTrackRow } from "../supabase/admin/tracks";
import { withAdmin } from "./guard";

// Aulas
export const findLessonByYoutube = withAdmin(findLessonByYoutubeId);
export const saveLesson = withAdmin(saveLessonRpc);
export const saveLessonKeyPoints = withAdmin(setLessonKeyPoints);
export const saveLessonText = withAdmin(writeLessonText);
export const saveLessonTranscript = withAdmin(writeLessonTranscript);
export const setLessonPublished = withAdmin(setPublished);
export const deleteLesson = withAdmin(removeLesson);
export const linkLesson = withAdmin(linkLessonToModule);
export const unlinkLesson = withAdmin(unlinkLessonFromModule);
export const getModuleLessonIds = withAdmin(listModuleLessonIds);
export const reorderLessonsInModule = withAdmin(reorderModuleLessons);

// Módulos
export const renameModule = withAdmin(renameModuleRow);
export const createModule = withAdmin(insertModule);
export const deleteModule = withAdmin(removeModule);
export const getTrackIdOfModule = withAdmin(getModuleTrackId);
export const getTrackModuleIds = withAdmin(listTrackModuleIds);
export const reorderModules = withAdmin(reorderModuleRows);

// Novidades
export const updateNews = withAdmin(updateNewsRow);
export const createNews = withAdmin(insertNews);
export const deleteNews = withAdmin(removeNews);
export const getNewsIds = withAdmin(listNewsIds);
export const reorderNews = withAdmin(reorderNewsRows);

// Dúvidas
export const answerQuestionRow = withAdmin(writeAnswer);

// Quizzes
export const saveQuiz = withAdmin(replaceQuiz);

// Trilhas
export const updateTrack = withAdmin(updateTrackRow);
export const createTrack = withAdmin(insertTrack);
export const deleteTrack = withAdmin(removeTrack);
export const getTrackIds = withAdmin(listTrackIds);
export const reorderTracks = withAdmin(reorderTrackRows);
