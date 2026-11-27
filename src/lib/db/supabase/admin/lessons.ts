import { createClient } from "../client";
import type { DbError } from "../../types";
import type { LessonInput } from "../../admin/types";

/** Aula que já usa este vídeo (um vídeo = uma aula), se houver. */
export async function findLessonByYoutubeId(youtubeId: string): Promise<{ id: string; title: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("id, title").eq("youtube_id", youtubeId).limit(1);
  return data?.length ? (data[0] as { id: string; title: string }) : null;
}

/** Cria ou edita a aula de forma atômica (RPC admin_save_lesson). Devolve o id da aula. */
export async function saveLessonRpc(id: string | null, moduleId: string | null, input: LessonInput): Promise<{ id: string | null; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_lesson", { p_id: id, p_module: moduleId, p_data: input });
  return { id: error ? null : (data as string), error };
}

/** Pontos-chave ficam fora da RPC para não depender da versão dela (migração 0007). */
export async function setLessonKeyPoints(id: string, keyPoints: string[]): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ key_points: keyPoints }).eq("id", id);
  return error;
}

/** Grava o texto da aula (migração 0008); texto vazio apaga. */
export async function writeLessonText(lessonId: string, body: string, published: boolean): Promise<DbError> {
  const supabase = await createClient();
  const { error } = body
    ? await supabase.from("lesson_texts").upsert({ lesson_id: lessonId, body, published, updated_at: new Date().toISOString() })
    : await supabase.from("lesson_texts").delete().eq("lesson_id", lessonId);
  return error;
}

/** Grava a transcrição só para a busca (migração 0009); vazia apaga. */
export async function writeLessonTranscript(lessonId: string, body: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = body
    ? await supabase.from("lesson_transcripts").upsert({ lesson_id: lessonId, body, updated_at: new Date().toISOString() })
    : await supabase.from("lesson_transcripts").delete().eq("lesson_id", lessonId);
  return error;
}

export async function setPublished(id: string, published: boolean): Promise<{ found: boolean; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lessons").update({ published }).eq("id", id).select("id");
  return { found: !!data?.length, error };
}

export async function removeLesson(id: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  return error;
}

export async function linkLessonToModule(lessonId: string, moduleId: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_link_lesson", { p_module: moduleId, p_lesson: lessonId });
  return error;
}

export async function unlinkLessonFromModule(lessonId: string, moduleId: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("module_lessons").delete().eq("module_id", moduleId).eq("lesson_id", lessonId);
  return error;
}

export async function listModuleLessonIds(moduleId: string): Promise<{ ids: string[]; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("module_lessons").select("lesson_id").eq("module_id", moduleId).order("position").order("lesson_id");
  return { ids: (data ?? []).map((r) => r.lesson_id as string), error };
}

export async function reorderModuleLessons(moduleId: string, ids: string[]): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_module_lessons", { p_module: moduleId, p_ids: ids });
  return error;
}
