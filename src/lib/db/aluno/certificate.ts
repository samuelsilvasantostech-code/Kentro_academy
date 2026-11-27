import { cache } from "react";
import { getCatalog } from "./catalog";
import { getMe } from "./me";
import { progress } from "@/lib/catalog";
import { insertCertificate, listCertificates, trackCompletion } from "../supabase/aluno/certificate";
import type { Completion, TrackStatus } from "./types";

/**
 * Situação de cada trilha para o aluno logado: certificado existente OU conclusão atual.
 * Quando a trilha está concluída e ainda não há certificado, ele é emitido aqui, com a data da conclusão.
 * É uma escrita durante a renderização (GET), aceita de propósito: é idempotente (a chave primária impede
 * duplicar), só acontece depois de uma conclusão real (o banco confere com track_completion) e
 * evita perder o certificado se a equipe publicar conteúdo antes de o aluno abrir a página.
 */
export const getTrackStatuses = cache(async (): Promise<Map<string, TrackStatus>> => {
  const [{ user, done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const issued = await listCertificates(user.id);

  const entries = await Promise.all(tracks.map(async (t): Promise<[string, TrackStatus]> => {
    const p = progress(t, done);
    // Concluir exige todas as aulas com vídeo feitas: sem isso não vale nem chamar a regra no banco.
    const c: Completion = p.total > 0 && p.pct === 100 ? await trackCompletion(t.id) : { completed: false, completed_at: null };
    let issuedAt = issued.get(t.id) ?? null;
    if (!issuedAt && c.completed && c.completed_at) {
      const error = await insertCertificate(user.id, t.id, c.completed_at);
      if (!error) issuedAt = c.completed_at;
      else if (error.code === "23505") issuedAt = c.completed_at; // outra aba emitiu no mesmo instante
      else console.error("emitir certificado", error.code);
    }
    return [t.id, { certified: !!issuedAt, issuedAt, completed: c.completed, hasNew: !!issuedAt && !c.completed }];
  }));
  return new Map(entries);
});
