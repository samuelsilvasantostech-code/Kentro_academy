import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalog, getMe, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export type Completion = { completed: boolean; completed_at: string | null };

/** Chama track_completion (security invoker: usa o usuário logado). A RPC pode devolver 1 linha em array. */
export async function trackCompletion(supabase: SupabaseClient, trackId: string): Promise<Completion> {
  const { data, error } = await supabase.rpc("track_completion", { p_track: trackId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { completed: false, completed_at: null };
  return { completed: !!row.completed, completed_at: row.completed_at ?? null };
}

export type TrackStatus = {
  /** Existe linha em track_certificates: o certificado é do aluno para sempre. */
  certified: boolean;
  /** Data da primeira conclusão (issued_at). */
  issuedAt: string | null;
  /** A trilha, do jeito que está hoje, está concluída (regra de track_completion). */
  completed: boolean;
  /** Tem certificado, mas a trilha ganhou conteúdo que o aluno ainda não fez. */
  hasNew: boolean;
};

/**
 * Situação de cada trilha para o aluno logado: certificado existente OU conclusão atual.
 * Quando a trilha está concluída e ainda não há certificado, ele é emitido aqui, com a data da conclusão.
 * É uma escrita durante a renderização (GET), aceita de propósito: é idempotente (a chave primária impede
 * duplicar), só acontece depois de uma conclusão real (o RLS confere com track_completion no banco), e
 * evita perder o certificado se a equipe publicar conteúdo antes de o aluno abrir a página.
 */
export const getTrackStatuses = cache(async (): Promise<Map<string, TrackStatus>> => {
  const [{ user, done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const supabase = await createClient();
  const { data: rows } = await supabase.from("track_certificates").select("track_id, issued_at").eq("user_id", user.id);
  const issued = new Map((rows ?? []).map((r) => [r.track_id as string, r.issued_at as string]));

  const entries = await Promise.all(tracks.map(async (t): Promise<[string, TrackStatus]> => {
    const p = progress(t, done);
    // Concluir exige todas as aulas com vídeo feitas: sem isso não vale nem chamar a regra no banco.
    const c = p.total > 0 && p.pct === 100 ? await trackCompletion(supabase, t.id) : { completed: false, completed_at: null };
    let issuedAt = issued.get(t.id) ?? null;
    if (!issuedAt && c.completed && c.completed_at) {
      const { error } = await supabase.from("track_certificates").insert({ track_id: t.id, issued_at: c.completed_at });
      if (!error) issuedAt = c.completed_at;
      else if (error.code === "23505") issuedAt = c.completed_at; // outra aba emitiu no mesmo instante
      else console.error("emitir certificado", error.code);
    }
    return [t.id, { certified: !!issuedAt, issuedAt, completed: c.completed, hasNew: !!issuedAt && !c.completed }];
  }));
  return new Map(entries);
});
