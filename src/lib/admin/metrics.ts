// Números do painel do admin. Tudo vem das tabelas reais (o RLS deixa o admin ler o progresso de todos).
// Admins ficam fora das contas. As leituras são paginadas: o Supabase devolve no máximo 1000 linhas por vez.
import { cache } from "react";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin/require-admin";
import { getAdminTracks } from "@/lib/admin/queries";

type Sb = NonNullable<Awaited<ReturnType<typeof getAdmin>>>["supabase"];
const PAGE = 1000;
const DAY = 86_400_000;
const PASS = 0.7;

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await q(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export type StudentRow = {
  id: string; name: string; company: string | null; joined: string;
  lessons: number; certs: number; currentTrack: string | null; lastActive: string | null;
};
export type TrackRow = { id: string; name: string; published: boolean; total: number; started: number; certified: number; avgPct: number };
export type QuizRow = { moduleId: string; trackName: string; moduleTitle: string; students: number; attempts: number; passRate: number; firstTryRate: number };
export type DropRow = { trackName: string; lessonTitle: string; reached: number; previous: number };

export const getMetrics = cache(async () => {
  const now = Date.now();
  const a = await getAdmin();
  if (!a) notFound();
  const sb: Sb = a.supabase;

  const [tracks, profiles, progress, attempts, certs, pending] = await Promise.all([
    getAdminTracks(),
    all<{ id: string; full_name: string | null; company: string | null; is_admin: boolean; last_track_id: string | null; created_at: string }>((f, t) =>
      sb.from("profiles").select("id, full_name, company, is_admin, last_track_id, created_at").order("id").range(f, t)),
    all<{ user_id: string; lesson_id: string; completed_at: string }>((f, t) =>
      sb.from("lesson_progress").select("user_id, lesson_id, completed_at").order("user_id").order("lesson_id").range(f, t)),
    all<{ user_id: string; module_id: string; score: number; total: number; created_at: string }>((f, t) =>
      sb.from("quiz_attempts").select("user_id, module_id, score, total, created_at").order("created_at").range(f, t)),
    all<{ user_id: string; track_id: string; issued_at: string }>((f, t) =>
      sb.from("track_certificates").select("user_id, track_id, issued_at").order("user_id").order("track_id").range(f, t)),
    sb.from("lesson_questions").select("id", { count: "exact", head: true }).is("answer", null),
  ]);

  const students = profiles.filter((p) => !p.is_admin);
  const isStudent = new Set(students.map((p) => p.id));
  const prog = progress.filter((r) => isStudent.has(r.user_id));
  const tries = attempts.filter((r) => isStudent.has(r.user_id));
  const cert = certs.filter((r) => isStudent.has(r.user_id));

  // Atividade = concluir aula ou fazer quiz (o sistema não registra login nem tempo assistido).
  const last = new Map<string, string>();
  const touch = (u: string, at: string) => { if (!last.has(u) || at > last.get(u)!) last.set(u, at); };
  prog.forEach((r) => touch(r.user_id, r.completed_at));
  tries.forEach((r) => touch(r.user_id, r.created_at));
  const activeIn = (days: number) => [...last.values()].filter((at) => now - Date.parse(at) <= days * DAY).length;

  const doneBy = new Map<string, Set<string>>();
  prog.forEach((r) => { if (!doneBy.has(r.user_id)) doneBy.set(r.user_id, new Set()); doneBy.get(r.user_id)!.add(r.lesson_id); });
  const certCount = new Map<string, number>();
  cert.forEach((r) => certCount.set(r.user_id, (certCount.get(r.user_id) ?? 0) + 1));
  const trackName = new Map(tracks.map((t) => [t.id, t.name]));

  // Trilhas: mesma regra do progresso do aluno (aulas publicadas com vídeo).
  const trackRows: TrackRow[] = [];
  const drops: DropRow[] = [];
  for (const t of tracks) {
    const lessons = t.modules.flatMap((m) => m.lessons.filter((l) => l.published && l.youtube_id));
    const ids = lessons.map((l) => l.id);
    const starters = students.filter((s) => ids.some((id) => doneBy.get(s.id)?.has(id)));
    const pcts = starters.map((s) => ids.filter((id) => doneBy.get(s.id)!.has(id)).length / (ids.length || 1));
    trackRows.push({
      id: t.id, name: t.name, published: t.published, total: ids.length, started: starters.length,
      certified: cert.filter((c) => c.track_id === t.id).length,
      avgPct: pcts.length ? Math.round((pcts.reduce((x, y) => x + y, 0) / pcts.length) * 100) : 0,
    });
    // Onde a turma para: queda de uma aula para a seguinte, entre quem começou a trilha.
    const reached = lessons.map((l) => starters.filter((s) => doneBy.get(s.id)!.has(l.id)).length);
    for (let i = 1; i < lessons.length; i++) {
      if (reached[i - 1] > reached[i]) drops.push({ trackName: t.name, lessonTitle: lessons[i].title, reached: reached[i], previous: reached[i - 1] });
    }
  }
  drops.sort((x, y) => (y.previous - y.reached) / y.previous - (x.previous - x.reached) / x.previous || y.previous - x.previous);

  // Quizzes: aprovação geral e na primeira tentativa de cada aluno.
  const quizRows: QuizRow[] = [];
  for (const t of tracks) for (const m of t.modules) {
    const list = tries.filter((r) => r.module_id === m.id);
    if (!list.length) continue;
    const firstBy = new Map<string, (typeof list)[number]>();
    list.forEach((r) => { if (!firstBy.has(r.user_id)) firstBy.set(r.user_id, r); }); // já vem em ordem de data
    const ok = (r: { score: number; total: number }) => r.total > 0 && r.score / r.total >= PASS;
    quizRows.push({
      moduleId: m.id, trackName: t.name, moduleTitle: m.title, students: firstBy.size, attempts: list.length,
      passRate: Math.round((list.filter(ok).length / list.length) * 100),
      firstTryRate: Math.round(([...firstBy.values()].filter(ok).length / firstBy.size) * 100),
    });
  }
  quizRows.sort((x, y) => x.firstTryRate - y.firstTryRate);

  const studentRows: StudentRow[] = students
    .map((s) => ({
      id: s.id, name: s.full_name?.trim() || "Sem nome", company: s.company?.trim() || null, joined: s.created_at,
      lessons: doneBy.get(s.id)?.size ?? 0, certs: certCount.get(s.id) ?? 0,
      currentTrack: s.last_track_id ? trackName.get(s.last_track_id) ?? null : null, lastActive: last.get(s.id) ?? null,
    }))
    .sort((x, y) => (y.lastActive ?? "").localeCompare(x.lastActive ?? ""));

  return {
    generatedAt: new Date(now).toISOString(),
    totals: {
      students: students.length,
      newIn30: students.filter((s) => now - Date.parse(s.created_at) <= 30 * DAY).length,
      active7: activeIn(7),
      active30: activeIn(30),
      lessonsDone: prog.length,
      certificates: cert.length,
      pendingQuestions: pending.count ?? 0,
    },
    tracks: trackRows,
    quizzes: quizRows,
    drops: drops.slice(0, 6),
    students: studentRows,
    companies: [...new Set(studentRows.map((s) => s.company).filter((c): c is string => !!c))].sort((x, y) => x.localeCompare(y, "pt-BR")),
  };
});
