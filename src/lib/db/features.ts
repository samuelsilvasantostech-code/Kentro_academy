import { cache } from "react";
import { probeLearningFeatures, probeLessonTexts, probeTranscripts } from "./supabase/features";

// Migrações opcionais já aplicadas? Enquanto não, os recursos ficam escondidos e o resto do app segue igual.
// Uma consulta por requisição cada.

/** 0007: pontos-chave, posição do vídeo na conta e "reveja a aula" no quiz. */
export const hasLearningFeatures = cache(probeLearningFeatures);
/** 0009: busca por transcrição. Só o admin lê a tabela; sem a migração o campo some do admin. */
export const hasTranscripts = cache(probeTranscripts);
/** 0008: texto explicativo da aula. Sem ela, o artigo e o campo no admin ficam escondidos. */
export const hasLessonTexts = cache(probeLessonTexts);
