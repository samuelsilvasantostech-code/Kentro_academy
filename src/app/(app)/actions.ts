"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCatalog, lessonsOf } from "@/lib/catalog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Log de erro do banco no servidor: só ação e código, nunca dados do aluno. */
function logErr(action: string, error: { code?: string; message?: string } | null) {
  if (error) console.error(JSON.stringify({ level: "error", scope: "app", action, code: error.code ?? null, message: error.message ?? null }));
}

/** A aula existe no catálogo visível para este usuário (RLS já esconde rascunhos). */
async function lessonVisible(lessonId: string) {
  if (typeof lessonId !== "string" || !lessonId) return false;
  const cat = await getCatalog();
  return cat.some((t) => t.modules.some((m) => m.lessons.some((l) => l.id === lessonId)));
}

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return { supabase, user };
}

export type NameState = { ok?: true; error?: string; name?: string };

/** O aluno corrige o próprio nome (é o nome que sai no certificado). O RLS só deixa mudar a própria linha. */
export async function updateName(_prev: NameState, form: FormData): Promise<NameState> {
  const { supabase, user } = await authed();
  const name = String(form.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 80) return { error: "Use de 3 a 80 caracteres.", name };
  if (!/\p{L}/u.test(name)) return { error: "Digite um nome válido.", name };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  logErr("updateName", error);
  if (error) return { error: "Não foi possível salvar agora. Tente de novo.", name };
  revalidatePath("/", "layout");
  return { ok: true, name };
}

export async function finishOnboarding(trackId: string, experience: string) {
  const { supabase, user } = await authed();
  const track = (await getCatalog()).find((t) => t.id === trackId);
  if (!track) return;
  const exp = String(experience ?? "").trim().slice(0, 60);
  const { error } = await supabase.from("profiles").update({ role_track: trackId, experience: exp, last_track_id: trackId }).eq("id", user.id);
  logErr("finishOnboarding", error);
  redirect(`/trilha/${trackId}`);
}

/** Marca a aula como concluída e leva à próxima (ou ao quiz, se o módulo acabou). */
export async function completeLesson(trackId: string, lessonId: string) {
  const { supabase, user } = await authed();
  const track = (await getCatalog()).find((t) => t.id === trackId);
  if (!track) return;
  const L = lessonsOf(track);
  const i = L.findIndex((l) => l.id === lessonId);
  if (i < 0) return;

  const { data: before } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id);
  const done = new Set((before ?? []).map((r) => r.lesson_id as string));
  const was = done.has(lessonId);
  if (!was) logErr("completeLesson", (await supabase.from("lesson_progress").insert({ lesson_id: lessonId })).error);
  done.add(lessonId);
  revalidatePath("/", "layout");

  const mod = track.modules[L[i].moduleIndex];
  const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("module_id", mod.id);
  if (!was && count && mod.lessons.every((l) => done.has(l.id))) redirect(`/quiz/${trackId}/${L[i].moduleIndex}`);

  const next = L[i + 1];
  redirect(next ? `/aula/${trackId}/${next.id}` : `/trilha/${trackId}?concluida=1`);
}

export async function undoLesson(lessonId: string) {
  const { supabase, user } = await authed();
  logErr("undoLesson", (await supabase.from("lesson_progress").delete().eq("user_id", user.id).eq("lesson_id", lessonId)).error);
  revalidatePath("/", "layout");
}

export async function saveNote(lessonId: string, body: string) {
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  const { supabase } = await authed();
  if (!(await lessonVisible(lessonId))) return;
  logErr("saveNote", (await supabase.from("notes").insert({ lesson_id: lessonId, body: text })).error);
  revalidatePath("/", "layout");
}

export async function deleteNote(id: string) {
  const { supabase } = await authed();
  if (typeof id !== "string" || !UUID.test(id)) return;
  logErr("deleteNote", (await supabase.from("notes").delete().eq("id", id)).error);
  revalidatePath("/", "layout");
}

export async function askQuestion(lessonId: string, body: string) {
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  const { supabase } = await authed();
  if (!(await lessonVisible(lessonId))) return;
  logErr("askQuestion", (await supabase.from("lesson_questions").insert({ lesson_id: lessonId, body: text })).error);
  revalidatePath("/", "layout");
}

/** O aluno abriu a aba Dúvidas: marca como vistas as respostas desta aula (RPC; o aluno não atualiza a tabela). */
export async function markAnswersSeen(lessonId: string) {
  const { supabase } = await authed();
  if (typeof lessonId !== "string" || !lessonId || lessonId.length > 120) return;
  logErr("markAnswersSeen", (await supabase.rpc("mark_answers_seen", { p_lesson: lessonId })).error);
  revalidatePath("/", "layout");
}

export type QuizResult = {
  score: number;
  total: number;
  passed: boolean;
  /** Acerto por questão. */
  results: boolean[];
  /** Só vêm quando passed = true. */
  correct?: number[];
  explanations?: string[];
  /** Só vem quando o banco recusou por tentativa seguida (too_fast). */
  tooFast?: true;
};

/** Corrige no banco (submit_quiz). Sem aprovação, o aluno só recebe acerto/erro por questão, nunca o gabarito. */
export async function submitQuiz(moduleId: string, answers: number[]): Promise<QuizResult | null> {
  const { supabase } = await authed();
  if (typeof moduleId !== "string" || !UUID.test(moduleId)) return null;
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 100 || !answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 5)) return null;
  const { data, error } = await supabase.rpc("submit_quiz", { p_module: moduleId, p_answers: answers });
  logErr("submitQuiz", error);
  if (error?.code === "54000") return { score: 0, total: 0, passed: false, results: [], tooFast: true };
  if (error || !data) return null;
  revalidatePath("/", "layout");
  return data as QuizResult;
}
