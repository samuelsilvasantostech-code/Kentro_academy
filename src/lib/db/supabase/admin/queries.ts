// Leituras do /admin. Rascunhos e trilhas não publicadas aparecem aqui; o gabarito do quiz vem sempre
// pela RPC admin_quiz_questions. A prova de admin é exigida em src/lib/db/admin (esta camada só consulta).
import { createClient } from "../client";
import type { Chapter, Material } from "@/lib/admin/validate";
import type {
  AdminLessonDetail, AdminLessonLink, AdminLessonListItem, AdminLessonRow, AdminNews, AdminQuestion, AdminQuizQuestion, AdminTrack,
} from "../../admin/types";

/** Trilhas > módulos > aulas (com rascunhos), na ordem de exibição, e quantas perguntas cada módulo tem. */
export async function loadAdminTracks(): Promise<AdminTrack[]> {
  const supabase = await createClient();
  const [tracks, quiz] = await Promise.all([
    supabase
      .from("tracks")
      .select("*, modules(id, title, position, module_lessons(position, lessons(id, youtube_id, title, duration_seconds, published)))")
      .order("position"),
    supabase.from("quiz_questions").select("module_id"),
  ]);
  if (tracks.error) throw tracks.error;
  const counts = new Map<string, number>();
  (quiz.data ?? []).forEach((q) => counts.set(q.module_id, (counts.get(q.module_id) ?? 0) + 1));

  type Row = Omit<AdminTrack, "modules"> & {
    modules: { id: string; title: string; position: number; module_lessons: { position: number; lessons: Omit<AdminLessonRow, "position"> }[] }[];
  };
  return (tracks.data as unknown as Row[]).map(({ modules, ...t }) => ({
    ...t,
    modules: [...modules]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        quizCount: counts.get(m.id) ?? 0,
        lessons: [...m.module_lessons].sort((a, b) => a.position - b.position).map((ml) => ({ ...ml.lessons, position: ml.position })),
      })),
  }));
}

type LessonLinkRow = { modules: { id: string; title: string; tracks: { id: string; name: string } | null } | null }[];
const toLinks = (rows: LessonLinkRow): AdminLessonLink[] =>
  rows.flatMap((r) =>
    r.modules && r.modules.tracks
      ? [{ moduleId: r.modules.id, moduleTitle: r.modules.title, trackId: r.modules.tracks.id, trackName: r.modules.tracks.name }]
      : [],
  );

/** Todas as aulas (publicadas e rascunhos), mais recentes primeiro, com os módulos/trilhas em que estão. */
export async function loadAdminLessons(): Promise<AdminLessonListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("id, youtube_id, title, duration_seconds, published, created_at, module_lessons(modules(id, title, tracks(id, name)))")
    .order("created_at", { ascending: false })
    .order("title");
  if (error) throw error;
  return (data as unknown as (Omit<AdminLessonListItem, "links" | "position"> & { module_lessons: LessonLinkRow })[]).map(
    ({ module_lessons, ...l }) => ({ ...l, position: 0, links: toLinks(module_lessons) }),
  );
}

/** Uma aula completa para o formulário de edição. */
export async function loadAdminLesson(id: string): Promise<AdminLessonDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "id, youtube_id, title, summary, duration_seconds, steps, published, chapters(start_seconds, title), materials(title, url, description, position), module_lessons(modules(id, title, tracks(id, name)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as unknown as Omit<AdminLessonDetail, "links" | "materials" | "chapters"> & {
    chapters: Chapter[]; materials: (Material & { position: number })[]; module_lessons: LessonLinkRow;
  };
  const { module_lessons, chapters, materials, ...rest } = d;
  // Consulta à parte: antes da migração 0007 a coluna não existe e o erro é ignorado.
  const [{ data: kp }, { data: tx }, { data: tr }] = await Promise.all([
    supabase.from("lessons").select("key_points").eq("id", id).maybeSingle(),
    supabase.from("lesson_texts").select("body, published").eq("lesson_id", id).maybeSingle(),
    supabase.from("lesson_transcripts").select("body").eq("lesson_id", id).maybeSingle(),
  ]);
  return {
    ...rest,
    text: { body: (tx?.body as string | undefined) ?? "", published: !!tx?.published },
    transcript: (tr?.body as string | undefined) ?? "",
    key_points: (kp?.key_points as string[] | undefined) ?? [],
    chapters: [...chapters].sort((a, b) => a.start_seconds - b.start_seconds),
    materials: [...materials].sort((a, b) => a.position - b.position).map(({ title, url, description }) => ({ title, url, description })),
    links: toLinks(module_lessons),
  };
}

/** Gabarito completo de um módulo (RPC admin_quiz_questions: a tabela não entrega correct/explanation nem ao admin). */
export async function loadAdminQuiz(moduleId: string): Promise<AdminQuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_quiz_questions", { p_module: moduleId });
  if (error) throw error;
  return (data ?? []) as AdminQuizQuestion[];
}

/**
 * Dúvidas dos alunos. "pending" = sem resposta, mais antigas primeiro (a fila);
 * "answered" = respondidas, mais recentes primeiro. Até `limit` itens.
 */
export async function loadQuestions(status: "pending" | "answered", limit: number): Promise<AdminQuestion[]> {
  const supabase = await createClient();
  const base = supabase.from("lesson_questions").select("id, user_id, lesson_id, body, answer, created_at, answered_at");
  const { data, error } =
    status === "pending"
      ? await base.is("answer", null).order("created_at", { ascending: true }).limit(limit)
      : await base.not("answer", "is", null).order("answered_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const [lessons, profiles] = await Promise.all([
    supabase.from("lessons").select("id, title").in("id", [...new Set(rows.map((r) => r.lesson_id))]),
    supabase.from("profiles").select("id, full_name, company").in("id", [...new Set(rows.map((r) => r.user_id))]),
  ]);
  const L = new Map((lessons.data ?? []).map((l) => [l.id as string, l.title as string]));
  const P = new Map((profiles.data ?? []).map((p) => [p.id as string, p as { id: string; full_name: string; company: string | null }]));
  return rows.map((r) => ({
    id: r.id, body: r.body, answer: r.answer, created_at: r.created_at, answered_at: r.answered_at,
    lesson: { id: r.lesson_id, title: L.get(r.lesson_id) ?? "Aula excluída" },
    student: P.get(r.user_id) ?? { id: r.user_id, full_name: "Aluno", company: null },
  }));
}

/** Quantas dúvidas estão sem resposta. */
export async function countPendingQuestions(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("lesson_questions").select("id", { count: "exact", head: true }).is("answer", null);
  return count ?? 0;
}

export async function loadAdminNews(): Promise<AdminNews[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("news").select("*").order("position");
  if (error) throw error;
  return data as AdminNews[];
}
