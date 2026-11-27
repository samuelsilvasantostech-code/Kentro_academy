"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/db/auth";
import {
  addNote, addQuestion, countQuizQuestions, deleteNote as dbDeleteNote, finishOnboardingFor, getCatalog, getDoneLessonIds,
  markAnswersSeen as dbMarkAnswersSeen, markLessonDone, saveVideoPosition as dbSaveVideoPosition, submitQuiz as dbSubmitQuiz,
  unmarkLessonDone, updateName as dbUpdateName, type QuizResult,
} from "@/lib/db/aluno";
import { lessonsOf } from "@/lib/catalog";

export type { QuizResult };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Log de erro do banco no servidor: só ação e código, nunca dados do aluno. */
function logErr(action: string, error: { code?: string; message?: string } | null) {
  if (error) console.error(JSON.stringify({ level: "error", scope: "app", action, code: error.code ?? null, message: error.message ?? null }));
}

/** A aula existe no catálogo visível para este usuário (só publicadas). */
async function lessonVisible(lessonId: string) {
  if (typeof lessonId !== "string" || !lessonId) return false;
  const cat = await getCatalog();
  return cat.some((t) => t.modules.some((m) => m.lessons.some((l) => l.id === lessonId)));
}

async function authed() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
}

export type NameState = { ok?: true; error?: string; name?: string };

/** O aluno corrige o próprio nome (é o nome que sai no certificado). Só muda a própria linha. */
export async function updateName(_prev: NameState, form: FormData): Promise<NameState> {
  const user = await authed();
  const name = String(form.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 80) return { error: "O nome precisa ter de 3 a 80 caracteres.", name };
  if (!/\p{L}/u.test(name)) return { error: "Digite seu nome usando letras.", name };
  const error = await dbUpdateName(user.id, name);
  logErr("updateName", error);
  if (error) return { error: "Não foi possível salvar o nome. Tente de novo em instantes.", name };
  revalidatePath("/", "layout");
  return { ok: true, name };
}

export async function finishOnboarding(trackId: string, experience: string) {
  const user = await authed();
  const track = (await getCatalog()).find((t) => t.id === trackId);
  if (!track) return;
  const exp = String(experience ?? "").trim().slice(0, 60);
  logErr("finishOnboarding", await finishOnboardingFor(user.id, trackId, exp));
  redirect(`/trilha/${trackId}`);
}

/** Marca a aula como concluída e leva à próxima (ou ao quiz, se o módulo acabou). */
export async function completeLesson(trackId: string, lessonId: string) {
  const user = await authed();
  const track = (await getCatalog()).find((t) => t.id === trackId);
  if (!track) return;
  const L = lessonsOf(track);
  const i = L.findIndex((l) => l.id === lessonId);
  if (i < 0) return;

  const done = await getDoneLessonIds(user.id);
  const was = done.has(lessonId);
  if (!was) logErr("completeLesson", await markLessonDone(user.id, lessonId));
  done.add(lessonId);
  revalidatePath("/", "layout");

  const mod = track.modules[L[i].moduleIndex];
  const count = await countQuizQuestions(mod.id);
  if (!was && count && mod.lessons.every((l) => done.has(l.id))) redirect(`/quiz/${trackId}/${L[i].moduleIndex}`);

  const next = L[i + 1];
  redirect(next ? `/aula/${trackId}/${next.id}` : `/trilha/${trackId}?concluida=1`);
}

export async function undoLesson(lessonId: string) {
  const user = await authed();
  logErr("undoLesson", await unmarkLessonDone(user.id, lessonId));
  revalidatePath("/", "layout");
}

export async function saveNote(lessonId: string, body: string) {
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  const user = await authed();
  if (!(await lessonVisible(lessonId))) return;
  logErr("saveNote", await addNote(user.id, lessonId, text));
  revalidatePath("/", "layout");
}

/** Só apaga anotação do próprio aluno (filtro por user_id, além do RLS). */
export async function deleteNote(id: string) {
  const user = await authed();
  if (typeof id !== "string" || !UUID.test(id)) return;
  logErr("deleteNote", await dbDeleteNote(user.id, id));
  revalidatePath("/", "layout");
}

export async function askQuestion(lessonId: string, body: string) {
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  const user = await authed();
  if (!(await lessonVisible(lessonId))) return;
  logErr("askQuestion", await addQuestion(user.id, lessonId, text));
  revalidatePath("/", "layout");
}

/** O aluno abriu a aba Dúvidas: marca como vistas as respostas desta aula (o aluno não atualiza a tabela direto). */
export async function markAnswersSeen(lessonId: string) {
  const user = await authed();
  if (typeof lessonId !== "string" || !lessonId || lessonId.length > 120) return;
  logErr("markAnswersSeen", await dbMarkAnswersSeen(user.id, lessonId));
  revalidatePath("/", "layout");
}

/** Corrige no banco (submit_quiz). Sem aprovação, o aluno só recebe acerto/erro por questão, nunca o gabarito. */
export async function submitQuiz(moduleId: string, answers: number[]): Promise<QuizResult | null> {
  await authed();
  if (typeof moduleId !== "string" || !UUID.test(moduleId)) return null;
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 100 || !answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 5)) return null;
  const { result, error } = await dbSubmitQuiz(moduleId, answers);
  logErr("submitQuiz", error);
  if (error?.code === "54000") return { score: 0, total: 0, passed: false, results: [], tooFast: true };
  if (error || !result) return null;
  revalidatePath("/", "layout");
  return result;
}

/**
 * Guarda na conta onde o aluno parou no vídeo (tabela da migração 0007; sem ela, falha em silêncio
 * e a retomada continua só neste navegador). Perto do início ou do fim apaga, para recomeçar do zero.
 */
export async function saveVideoPosition(lessonId: string, seconds: number, total: number) {
  if (typeof lessonId !== "string" || !lessonId || lessonId.length > 64 || !Number.isFinite(seconds) || !Number.isFinite(total)) return;
  const user = await authed();
  logErr("saveVideoPosition", await dbSaveVideoPosition(user.id, lessonId, seconds, total));
}
