import { createClient } from "../client";
import type { Chapter, LessonNote, LessonPage, LessonQuestion, MaterialItem } from "../../aluno/types";

/**
 * Tudo que a página da aula lê, em paralelo. Os pontos-chave e a posição do vídeo vêm em consultas próprias:
 * antes da migração 0007 dão erro, que é ignorado (o mesmo vale para o texto da aula, migração 0008).
 *
 * `preview` (só o admin vendo como aluno): lê também aula e texto em rascunho. Para o aluno, cada leitura
 * filtra `published` explicitamente (aula publicada e, no texto, texto publicado), sem depender do RLS.
 */
export async function loadLessonPage(args: { userId: string; lessonId: string; moduleIds: string[]; preview: boolean }): Promise<LessonPage> {
  const { userId, lessonId, moduleIds, preview } = args;
  const supabase = await createClient();

  const chaptersQ = preview
    ? supabase.from("chapters").select("start_seconds, title").eq("lesson_id", lessonId).order("start_seconds")
    : supabase.from("chapters").select("start_seconds, title, lessons!inner(published)").eq("lesson_id", lessonId).eq("lessons.published", true).order("start_seconds");
  const materialsQ = preview
    ? supabase.from("materials").select("id, title, description, url").eq("lesson_id", lessonId).order("position")
    : supabase.from("materials").select("id, title, description, url, lessons!inner(published)").eq("lesson_id", lessonId).eq("lessons.published", true).order("position");
  const keyPointsQ = preview
    ? supabase.from("lessons").select("key_points").eq("id", lessonId).maybeSingle()
    : supabase.from("lessons").select("key_points").eq("id", lessonId).eq("published", true).maybeSingle();
  const textQ = preview
    ? supabase.from("lesson_texts").select("body, published").eq("lesson_id", lessonId).maybeSingle()
    : supabase.from("lesson_texts").select("body, published, lessons!inner(published)").eq("lesson_id", lessonId).eq("published", true).eq("lessons.published", true).maybeSingle();

  const [ch, mt, notes, questions, quizRows, kp, vp, tx] = await Promise.all([
    chaptersQ,
    materialsQ,
    supabase.from("notes").select("id, body, created_at").eq("lesson_id", lessonId).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("lesson_questions").select("id, body, answer, created_at, answered_at, answer_seen_at").eq("lesson_id", lessonId).eq("user_id", userId).order("created_at", { ascending: false }),
    // Só a coluna module_id: o gabarito (correct/explanation) nunca é lido pelo caminho do aluno.
    supabase.from("quiz_questions").select("module_id").in("module_id", moduleIds),
    keyPointsQ,
    supabase.from("video_progress").select("seconds").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle(),
    textQ,
  ]);

  const body = tx.data?.body as string | undefined;
  return {
    chapters: ((ch.data ?? []) as Chapter[]).map(({ start_seconds, title }) => ({ start_seconds, title })),
    materials: ((mt.data ?? []) as MaterialItem[]).map(({ id, title, description, url }) => ({ id, title, description, url })),
    notes: (notes.data ?? []) as LessonNote[],
    questions: (questions.data ?? []) as LessonQuestion[],
    quizModuleIds: new Set((quizRows.data ?? []).map((r) => r.module_id as string)),
    keyPoints: (kp.data?.key_points as string[] | undefined) ?? [],
    serverAt: typeof vp.data?.seconds === "number" ? vp.data.seconds : null,
    article: body?.trim() ? { md: body, draft: !tx.data?.published } : null,
  };
}
