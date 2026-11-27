import { createClient } from "../client";
import type { DbError } from "../../types";
import type { Completion } from "../../aluno/types";

/** Certificados do aluno (trilha -> data de emissão). */
export async function listCertificates(userId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("track_certificates").select("track_id, issued_at").eq("user_id", userId);
  return new Map((rows ?? []).map((r) => [r.track_id as string, r.issued_at as string]));
}

/** Chama track_completion (security invoker: usa o usuário da sessão). A RPC pode devolver 1 linha em array. */
export async function trackCompletion(trackId: string): Promise<Completion> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("track_completion", { p_track: trackId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { completed: false, completed_at: null };
  return { completed: !!row.completed, completed_at: row.completed_at ?? null };
}

/** Emite o certificado com a data da conclusão. A chave primária impede duplicar (23505). */
export async function insertCertificate(userId: string, trackId: string, issuedAt: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("track_certificates").insert({ user_id: userId, track_id: trackId, issued_at: issuedAt });
  return error;
}
