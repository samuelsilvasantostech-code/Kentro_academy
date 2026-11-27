import { createClient } from "../client";
import type { MetricsSource } from "../../admin/types";

// As leituras são paginadas: o Supabase devolve no máximo 1000 linhas por vez.
const PAGE = 1000;

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await q(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Linhas de todos os alunos para o painel (o RLS deixa o admin ler o progresso de todos). */
export async function loadMetricsSource(): Promise<MetricsSource> {
  const sb = await createClient();
  const [profiles, progress, attempts, certs, pending] = await Promise.all([
    all<MetricsSource["profiles"][number]>((f, t) =>
      sb.from("profiles").select("id, full_name, company, is_admin, last_track_id, created_at").order("id").range(f, t)),
    all<MetricsSource["progress"][number]>((f, t) =>
      sb.from("lesson_progress").select("user_id, lesson_id, completed_at").order("user_id").order("lesson_id").range(f, t)),
    all<MetricsSource["attempts"][number]>((f, t) =>
      sb.from("quiz_attempts").select("user_id, module_id, score, total, created_at").order("created_at").range(f, t)),
    all<MetricsSource["certs"][number]>((f, t) =>
      sb.from("track_certificates").select("user_id, track_id, issued_at").order("user_id").order("track_id").range(f, t)),
    sb.from("lesson_questions").select("id", { count: "exact", head: true }).is("answer", null),
  ]);
  return { profiles, progress, attempts, certs, pendingQuestions: pending.count ?? 0 };
}
