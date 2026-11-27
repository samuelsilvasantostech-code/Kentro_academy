import { cache } from "react";
import { loadPreviewCatalog, loadStudentCatalog } from "../supabase/aluno/catalog";
import { getMe } from "./me";
import type { Track } from "./types";

/**
 * Catálogo inteiro (são ~70 aulas): trilhas e aulas publicadas, com cache entre pedidos (tag CATALOG_TAG).
 * O admin vendo como aluno lê direto do banco e também enxerga trilhas em rascunho, que não podem cair no cache dos alunos.
 */
export const getCatalog = cache(async (): Promise<Track[]> => {
  const { profile } = await getMe();
  return profile?.is_admin ? loadPreviewCatalog() : loadStudentCatalog();
});
