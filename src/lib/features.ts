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
