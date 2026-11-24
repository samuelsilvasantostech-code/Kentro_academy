import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * A migração 0007 (pontos-chave, posição do vídeo na conta e "reveja a aula" no quiz) já foi aplicada?
 * Enquanto não for, esses recursos ficam escondidos e o resto do app segue igual. Uma consulta por requisição.
 */
export const hasLearningFeatures = cache(async () => {
  const supabase = await createClient();
  const { error } = await supabase.from("video_progress").select("lesson_id").limit(1);
  return !error;
});

/** A migração 0009 (busca por transcrição) já foi aplicada? Só o admin lê a tabela; sem a migração o campo some do admin. */
export const hasTranscripts = cache(async () => {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_transcripts").select("lesson_id").limit(1);
  return !error;
});

/** A migração 0008 (texto explicativo da aula) já foi aplicada? Sem ela, o artigo e o campo no admin ficam escondidos. */
export const hasLessonTexts = cache(async () => {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_texts").select("lesson_id").limit(1);
  return !error;
});
