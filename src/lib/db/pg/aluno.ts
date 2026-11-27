import { unstable_cache } from "next/cache";
import { exec, one, rows } from "./sql";
import { CATALOG_TAG, type DbError } from "../types";
import { queryGroups, type Hit, type MatchWhere } from "../../search";
import type {
  Chapter, Completion, LessonNote, LessonPage, LessonQuestion, MaterialItem, NewsItem, Note, Profile, QuizForStudent,
  StudentState, Track, UnseenAnswer,
} from "../aluno/types";

/**
 * Área do aluno no Postgres do Doca. Sem RLS: TODA consulta filtra pelo aluno (user_id = $1) e pelo que está
 * publicado. Mesmas funções (nomes e formatos) de supabase/aluno/*, escolhidas em db/aluno por DATA_BACKEND.
 * O gabarito do quiz (correct/explanation) nunca é lido aqui: as perguntas vêm da view quiz_questions_aluno.
 */

// ---------- catálogo ----------
async function loadCatalog(studentView: boolean): Promise<Track[]> {
  const tracks = await rows<Omit<Track, "modules">>(
    `select id, name, audience, icon, color, pitch, outcomes, position from tracks
     where ($1::boolean is false or published) order by position, id`,
    [studentView],
  );
  // Aula em rascunho nunca entra no catálogo (nem no do admin: ele edita pelo /admin).
  const mods = await rows<{ track_id: string; id: string; title: string; position: number; lessons: Track["modules"][number]["lessons"] }>(
    `select m.track_id, m.id, m.title, m.position,
       coalesce(json_agg(json_build_object('id', l.id, 'youtube_id', l.youtube_id, 'title', l.title,
         'duration_seconds', l.duration_seconds, 'summary', l.summary, 'steps', l.steps)
         order by ml.position, l.id) filter (where l.id is not null), '[]') as lessons
     from modules m
     left join module_lessons ml on ml.module_id = m.id
     left join lessons l on l.id = ml.lesson_id and l.published
     where m.track_id = any($1::text[])
     group by m.id order by m.position, m.id`,
    [tracks.map((t) => t.id)],
  );
  return tracks.map((t) => ({
    ...t,
    modules: mods.filter((m) => m.track_id === t.id).map(({ id, title, position, lessons }) => ({ id, title, position, lessons })),
  }));
}

/** Catálogo dos alunos (só publicado), em cache entre pedidos até o admin publicar algo ou 5 min. */
export const loadStudentCatalog = unstable_cache(() => loadCatalog(true), ["catalogo-aluno-pg-v1"], { tags: [CATALOG_TAG], revalidate: 300 });
/** Admin vendo como aluno: inclui trilhas em rascunho e nunca vai para o cache dos alunos. */
export const loadPreviewCatalog = () => loadCatalog(false);

// ---------- perfil e progresso ----------
export async function loadStudentState(userId: string): Promise<StudentState> {
  const [profile, done, quizzes] = await Promise.all([
    one<Profile>(
      `select id, full_name, company, role_track, experience, is_admin, last_track_id, last_lesson_id from profiles where id = $1`,
      [userId],
    ),
    rows<{ lesson_id: string }>(`select lesson_id from lesson_progress where user_id = $1`, [userId]),
    rows<{ module_id: string; score: number; total: number }>(`select module_id, score, total from quiz_attempts where user_id = $1`, [userId]),
  ]);
  return { profile: profile as Profile, doneLessonIds: done.map((r) => r.lesson_id), quizAttempts: quizzes };
}

export const updateProfileName = (userId: string, name: string): Promise<DbError> =>
  exec(`update profiles set full_name = $2 where id = $1`, [userId, name]);
export const saveOnboarding = (userId: string, trackId: string, experience: string): Promise<DbError> =>
  exec(`update profiles set role_track = $2, experience = $3, last_track_id = $2 where id = $1`, [userId, trackId, experience]);
export const setLastLesson = (userId: string, trackId: string, lessonId: string): Promise<DbError> =>
  exec(`update profiles set last_track_id = $2, last_lesson_id = $3 where id = $1`, [userId, trackId, lessonId]);

export async function listDoneLessonIds(userId: string): Promise<string[]> {
  return (await rows<{ lesson_id: string }>(`select lesson_id from lesson_progress where user_id = $1`, [userId])).map((r) => r.lesson_id);
}
/** Só aula publicada pode ser marcada como feita. Repetir não é erro (mesmo efeito do Supabase com a chave primária). */
export const insertLessonDone = (userId: string, lessonId: string): Promise<DbError> =>
  exec(
    `insert into lesson_progress (user_id, lesson_id) select $1, id from lessons where id = $2 and published on conflict do nothing`,
    [userId, lessonId],
  );
export const deleteLessonDone = (userId: string, lessonId: string): Promise<DbError> =>
  exec(`delete from lesson_progress where user_id = $1 and lesson_id = $2`, [userId, lessonId]);

// ---------- certificado ----------
export async function listCertificates(userId: string): Promise<Map<string, string>> {
  const r = await rows<{ track_id: string; issued_at: string }>(`select track_id, issued_at from track_certificates where user_id = $1`, [userId]);
  return new Map(r.map((x) => [x.track_id, x.issued_at]));
}

export async function trackCompletionFor(userId: string, trackId: string): Promise<Completion> {
  try {
    const r = await one<Completion>(`select completed, completed_at from track_completion($1, $2)`, [userId, trackId]);
    return { completed: !!r?.completed, completed_at: r?.completed_at ?? null };
  } catch {
    return { completed: false, completed_at: null };
  }
}

/** Emite pelo banco (issue_certificate confere a conclusão e não duplica). Devolve a data ou null. */
export async function issueCertificate(userId: string, trackId: string): Promise<string | null> {
  const r = await one<{ at: string | null }>(`select issue_certificate($1, $2) as at`, [userId, trackId]);
  return r?.at ?? null;
}

// ---------- aula ----------
export async function loadLessonPage(args: { userId: string; lessonId: string; moduleIds: string[]; preview: boolean }): Promise<LessonPage> {
  const { userId, lessonId, moduleIds, preview } = args;
  // Para o aluno, tudo da aula só vem se a aula estiver publicada (e o texto, publicado).
  const visible = `exists (select 1 from lessons l where l.id = $1 and ($2::boolean or l.published))`;
  const p = [lessonId, preview];
  const [chapters, materials, notes, questions, quiz, kp, vp, tx] = await Promise.all([
    rows<Chapter>(`select start_seconds, title from chapters where lesson_id = $1 and ${visible} order by start_seconds`, p),
    rows<MaterialItem>(`select id, title, description, url from materials where lesson_id = $1 and ${visible} order by position`, p),
    rows<LessonNote>(`select id, body, created_at from notes where lesson_id = $1 and user_id = $2 order by created_at desc`, [lessonId, userId]),
    rows<LessonQuestion>(
      `select id, body, answer, created_at, answered_at, answer_seen_at from lesson_questions
       where lesson_id = $1 and user_id = $2 order by created_at desc`,
      [lessonId, userId],
    ),
    rows<{ module_id: string }>(`select distinct module_id from quiz_questions where module_id = any($1::uuid[])`, [moduleIds]),
    one<{ key_points: string[] }>(`select key_points from lessons where id = $1 and ($2::boolean or published)`, p),
    one<{ seconds: number }>(`select seconds from video_progress where user_id = $1 and lesson_id = $2`, [userId, lessonId]),
    one<{ body: string; published: boolean }>(
      `select body, published from lesson_texts where lesson_id = $1 and ($2::boolean or published) and ${visible}`,
      p,
    ),
  ]);
  return {
    chapters,
    materials,
    notes,
    questions,
    quizModuleIds: new Set(quiz.map((r) => r.module_id)),
    keyPoints: kp?.key_points ?? [],
    serverAt: typeof vp?.seconds === "number" ? vp.seconds : null,
    article: tx?.body?.trim() ? { md: tx.body, draft: !tx.published } : null,
  };
}

// ---------- quiz ----------
export async function loadQuizForStudent(moduleId: string): Promise<QuizForStudent> {
  const q = await rows<{ question: string; options: string[]; lesson_id: string | null }>(
    `select question, options, lesson_id from quiz_questions_aluno where module_id = $1 order by position, id`,
    [moduleId],
  );
  return { questions: q.map(({ question, options }) => ({ question, options })), review: q.map((r) => r.lesson_id ?? null) };
}

export async function countQuizQuestionsByModule(moduleIds: string[]): Promise<Map<string, number>> {
  const r = await rows<{ module_id: string; n: number }>(
    `select module_id, count(*)::int as n from quiz_questions where module_id = any($1::uuid[]) group by module_id`,
    [moduleIds],
  );
  return new Map(r.map((x) => [x.module_id, x.n]));
}

export async function countModuleQuizQuestions(moduleId: string): Promise<number> {
  return (await one<{ n: number }>(`select count(*)::int as n from quiz_questions where module_id = $1`, [moduleId]))?.n ?? 0;
}

/** Correção no banco (submit_quiz grava a tentativa do aluno). */
export async function submitQuizAnswersFor(userId: string, moduleId: string, answers: number[]): Promise<{ data: unknown; error: DbError }> {
  try {
    const r = await one<{ r: unknown }>(`select submit_quiz($1, $2, $3::int[]) as r`, [userId, moduleId, answers]);
    return { data: r?.r ?? null, error: null };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { data: null, error: { code: e.code, message: e.message } };
  }
}

// ---------- anotações, dúvidas, vídeo, novidades ----------
export const insertNote = (userId: string, lessonId: string, body: string): Promise<DbError> =>
  exec(`insert into notes (user_id, lesson_id, body) values ($1, $2, $3)`, [userId, lessonId, body]);
export const deleteNoteOf = (userId: string, id: string): Promise<DbError> =>
  exec(`delete from notes where id = $2 and user_id = $1`, [userId, id]);

export async function loadNotes(userId: string, limit: number): Promise<{ notes: Note[]; count: number }> {
  const [c, notes] = await Promise.all([
    one<{ n: number }>(`select count(*)::int as n from notes where user_id = $1`, [userId]),
    limit > 0
      ? rows<Note>(`select id, body, lesson_id, created_at from notes where user_id = $1 order by created_at desc limit $2`, [userId, limit])
      : Promise.resolve([] as Note[]),
  ]);
  return { notes, count: c?.n ?? 0 };
}

export const insertQuestion = (userId: string, lessonId: string, body: string): Promise<DbError> =>
  exec(`insert into lesson_questions (user_id, lesson_id, body) values ($1, $2, $3)`, [userId, lessonId, body]);
export const markAnswersSeenOf = (userId: string, lessonId: string): Promise<DbError> =>
  exec(`select mark_answers_seen($1, $2)`, [userId, lessonId]);

export const loadUnseenAnswers = (userId: string, limit: number): Promise<UnseenAnswer[]> =>
  rows<UnseenAnswer>(
    `select id, lesson_id, body, answered_at from lesson_questions
     where user_id = $1 and answer is not null and answer_seen_at is null order by answered_at desc limit $2`,
    [userId, limit],
  );

export async function saveVideoPositionOf(userId: string, lessonId: string, seconds: number, total: number): Promise<DbError> {
  const s = Math.floor(seconds);
  if (s < 10 || (total > 0 && s > total - 20)) {
    return exec(`delete from video_progress where user_id = $1 and lesson_id = $2`, [userId, lessonId]);
  }
  return exec(
    `insert into video_progress (user_id, lesson_id, seconds, updated_at) values ($1, $2, $3, now())
     on conflict (user_id, lesson_id) do update set seconds = excluded.seconds, updated_at = now()`,
    [userId, lessonId, Math.min(s, 86400)],
  );
}

export const loadPublishedNews = (limit: number): Promise<NewsItem[]> =>
  rows<NewsItem>(`select id, title, description, href from news where published order by position limit $1`, [limit]);

// ---------- busca ----------
function groupsJson(words: string[]): string | null {
  const g = queryGroups(words);
  return g == null ? null : JSON.stringify(g);
}

export async function searchLessonsRpc(q: string, words: string[]): Promise<Hit[] | null> {
  try {
    const r = await rows<{ lesson_id: string; matched: MatchWhere }>(
      `select lesson_id, matched from search_lessons($1, $2::jsonb)`,
      [q.slice(0, 120), groupsJson(words)],
    );
    return r.map((x) => ({ id: x.lesson_id, matched: x.matched }));
  } catch {
    return null;
  }
}

export async function loadPublishedTexts(ids?: string[]): Promise<Map<string, string>> {
  const r = await rows<{ lesson_id: string; body: string }>(
    `select t.lesson_id, t.body from lesson_texts t join lessons l on l.id = t.lesson_id
     where t.published and l.published and ($1::text[] is null or t.lesson_id = any($1::text[]))`,
    [ids ?? null],
  );
  return new Map(r.map((x) => [x.lesson_id, x.body]));
}

// ---------- recursos opcionais: no Doca todas as migrações já existem ----------
export const probeLearningFeatures = async () => true;
export const probeTranscripts = async () => true;
export const probeLessonTexts = async () => true;
