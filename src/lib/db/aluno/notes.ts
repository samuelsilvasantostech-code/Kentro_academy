import { deleteNoteOf, insertNote, loadNotes } from "../supabase/aluno/notes";
import type { DbError } from "../types";
import type { Note } from "./types";

export const addNote = (userId: string, lessonId: string, body: string): Promise<DbError> => insertNote(userId, lessonId, body);
/** Só apaga anotação do próprio usuário. */
export const deleteNote = (userId: string, id: string): Promise<DbError> => deleteNoteOf(userId, id);
/** Total de anotações do aluno e, com `limit` > 0, as mais recentes. */
export const getNotes = (userId: string, limit: number): Promise<{ notes: Note[]; count: number }> => loadNotes(userId, limit);
