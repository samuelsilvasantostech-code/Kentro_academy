import { createClient } from "../client";
import { queryGroups, type Hit, type MatchWhere } from "@/lib/search";

/** Busca no banco (RPC search_lessons, migração 0009; só aula publicada). Null = RPC ausente ou com erro. */
export async function searchLessonsRpc(q: string, words: string[]): Promise<Hit[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_lessons", { q: q.slice(0, 120), groups: queryGroups(words) });
  if (error) return null;
  return (data as { lesson_id: string; matched: MatchWhere }[]).map((r) => ({ id: r.lesson_id, matched: r.matched }));
}

/**
 * Textos publicados de aulas publicadas (nos dois casos filtrados na consulta).
 * Antes da migração 0008 a tabela não existe: devolve vazio.
 */
export async function loadPublishedTexts(ids?: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  let query = supabase
    .from("lesson_texts")
    .select("lesson_id, body, lessons!inner(published)")
    .eq("published", true)
    .eq("lessons.published", true);
  if (ids) query = query.in("lesson_id", ids);
  const { data, error } = await query;
  return new Map(error ? [] : (data ?? []).map((r) => [r.lesson_id as string, r.body as string]));
}
