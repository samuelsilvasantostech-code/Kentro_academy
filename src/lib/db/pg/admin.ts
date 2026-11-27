/* eslint-disable @typescript-eslint/no-unused-vars -- `_a` (id do admin) faz parte da assinatura comum */
import { exec, one, rows } from "./sql";
import type { DbError } from "../types";
import type { Chapter, Material, QuizQuestion } from "../../admin/validate";
import type {
  AdminLessonDetail, AdminLessonLink, AdminLessonListItem, AdminNews, AdminQuestion, AdminQuizQuestion, AdminTrack,
  LessonInput, MetricsSource, NewsInput, TrackInput,
} from "../admin/types";

/**
 * Admin no Postgres do Doca. Toda função recebe o id do admin primeiro (`a`): quem chama é db/admin, que só
 * existe com a prova de admin. As funções do banco que gravam em várias tabelas conferem is_admin(a) de novo.
 */
type Found = { found: boolean; error: DbError };

async function found(sql: string, params: unknown[]): Promise<Found> {
  try {
    return { found: (await rows(sql, params)).length > 0, error: null };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { found: false, error: { code: e.code, message: e.message } };
  }
}

async function ids(sql: string, params: unknown[] = []): Promise<{ ids: string[]; error: DbError }> {
  try {
    return { ids: (await rows<{ id: string }>(sql, params)).map((r) => r.id), error: null };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { ids: [], error: { code: e.code, message: e.message } };
  }
}

async function created(sql: string, params: unknown[]): Promise<{ id: string | null; error: DbError }> {
  try {
    return { id: (await one<{ id: string }>(sql, params))?.id ?? null, error: null };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { id: null, error: { code: e.code, message: e.message } };
  }
}

// ---------- leituras ----------
export async function loadAdminTracks(_a: string): Promise<AdminTrack[]> {
  const [tracks, mods] = await Promise.all([
    rows<Omit<AdminTrack, "modules">>(
      `select id, name, audience, icon, color, pitch, outcomes, position, published from tracks order by position, id`,
    ),
    rows<AdminTrack["modules"][number] & { track_id: string }>(
      `select m.track_id, m.id, m.title, m.position,
         (select count(*)::int from quiz_questions q where q.module_id = m.id) as "quizCount",
         coalesce(json_agg(json_build_object('id', l.id, 'youtube_id', l.youtube_id, 'title', l.title,
           'duration_seconds', l.duration_seconds, 'published', l.published, 'position', ml.position)
           order by ml.position, l.id) filter (where l.id is not null), '[]') as lessons
       from modules m
       left join module_lessons ml on ml.module_id = m.id
       left join lessons l on l.id = ml.lesson_id
       group by m.id order by m.position, m.id`,
    ),
  ]);
  return tracks.map((t) => ({
    ...t,
    modules: mods.filter((m) => m.track_id === t.id).map(({ track_id: _t, ...m }) => m),
  }));
}

const LINKS = `coalesce((select json_agg(json_build_object('moduleId', m.id, 'moduleTitle', m.title, 'trackId', t.id, 'trackName', t.name)
    order by t.position, m.position)
  from module_lessons ml join modules m on m.id = ml.module_id join tracks t on t.id = m.track_id
  where ml.lesson_id = l.id), '[]')`;

export async function loadAdminLessons(_a: string): Promise<AdminLessonListItem[]> {
  return rows<AdminLessonListItem>(
    `select l.id, l.youtube_id, l.title, l.duration_seconds, l.published, l.created_at, 0 as position, ${LINKS} as links
     from lessons l order by l.created_at desc, l.title`,
  );
}

export async function loadAdminLesson(_a: string, id: string): Promise<AdminLessonDetail | null> {
  const l = await one<Omit<AdminLessonDetail, "chapters" | "materials" | "text" | "transcript"> & { links: AdminLessonLink[] }>(
    `select l.id, l.youtube_id, l.title, l.summary, l.duration_seconds, l.steps, l.published, l.key_points, ${LINKS} as links
     from lessons l where l.id = $1`,
    [id],
  );
  if (!l) return null;
  const [chapters, materials, tx, tr] = await Promise.all([
    rows<Chapter>(`select start_seconds, title from chapters where lesson_id = $1 order by start_seconds`, [id]),
    rows<Material>(`select title, url, description from materials where lesson_id = $1 order by position`, [id]),
    one<{ body: string; published: boolean }>(`select body, published from lesson_texts where lesson_id = $1`, [id]),
    one<{ body: string }>(`select body from lesson_transcripts where lesson_id = $1`, [id]),
  ]);
  return {
    ...l,
    chapters,
    materials,
    text: { body: tx?.body ?? "", published: !!tx?.published },
    transcript: tr?.body ?? "",
  } as AdminLessonDetail;
}

/** Gabarito completo: só por aqui (caminho do admin). */
export const loadAdminQuiz = (_a: string, moduleId: string): Promise<AdminQuizQuestion[]> =>
  rows<AdminQuizQuestion>(
    `select id, position, question, options, correct, explanation, lesson_id from quiz_questions where module_id = $1 order by position, id`,
    [moduleId],
  );

export async function loadQuestions(_a: string, status: "pending" | "answered", limit: number): Promise<AdminQuestion[]> {
  const r = await rows<{
    id: string; body: string; answer: string | null; created_at: string; answered_at: string | null;
    lesson_id: string; lesson_title: string | null; user_id: string; full_name: string | null; company: string | null;
  }>(
    `select q.id, q.body, q.answer, q.created_at, q.answered_at, q.lesson_id, l.title as lesson_title,
       q.user_id, p.full_name, p.company
     from lesson_questions q
     left join lessons l on l.id = q.lesson_id
     left join profiles p on p.id = q.user_id
     where (case when $1 = 'pending' then q.answer is null else q.answer is not null end)
     order by case when $1 = 'pending' then q.created_at end asc, q.answered_at desc
     limit $2`,
    [status, limit],
  );
  return r.map((x) => ({
    id: x.id, body: x.body, answer: x.answer, created_at: x.created_at, answered_at: x.answered_at,
    lesson: { id: x.lesson_id, title: x.lesson_title ?? "Aula excluída" },
    student: x.full_name == null ? { id: x.user_id, full_name: "Aluno", company: null } : { id: x.user_id, full_name: x.full_name, company: x.company },
  }));
}

export async function countPendingQuestions(_a: string): Promise<number> {
  return (await one<{ n: number }>(`select count(*)::int as n from lesson_questions where answer is null`))?.n ?? 0;
}

export const loadAdminNews = (_a: string): Promise<AdminNews[]> =>
  rows<AdminNews>(`select id, title, description, href, position, published from news order by position, id`);

export async function loadMetricsSource(_a: string): Promise<MetricsSource> {
  const [profiles, progress, attempts, certs, pending] = await Promise.all([
    rows<MetricsSource["profiles"][number]>(`select id, full_name, company, is_admin, last_track_id, created_at from profiles order by id`),
    rows<MetricsSource["progress"][number]>(`select user_id, lesson_id, completed_at from lesson_progress order by user_id, lesson_id`),
    rows<MetricsSource["attempts"][number]>(`select user_id, module_id, score, total, created_at from quiz_attempts order by created_at`),
    rows<MetricsSource["certs"][number]>(`select user_id, track_id, issued_at from track_certificates order by user_id, track_id`),
    countPendingQuestions(_a),
  ]);
  return { profiles, progress, attempts, certs, pendingQuestions: pending };
}

// ---------- aulas ----------
export const findLessonByYoutubeId = (_a: string, youtubeId: string): Promise<{ id: string; title: string } | null> =>
  one(`select id, title from lessons where youtube_id = $1 limit 1`, [youtubeId]);

export const saveLessonRpc = (a: string, id: string | null, moduleId: string | null, input: LessonInput): Promise<{ id: string | null; error: DbError }> =>
  created(`select admin_save_lesson($1, $2, $3, $4::jsonb) as id`, [a, id, moduleId, JSON.stringify(input)]);

export const setLessonKeyPoints = (_a: string, id: string, keyPoints: string[]): Promise<DbError> =>
  exec(`update lessons set key_points = $2 where id = $1`, [id, keyPoints]);

export const writeLessonText = (_a: string, lessonId: string, body: string, published: boolean): Promise<DbError> =>
  body
    ? exec(
      `insert into lesson_texts (lesson_id, body, published, updated_at) values ($1, $2, $3, now())
       on conflict (lesson_id) do update set body = excluded.body, published = excluded.published, updated_at = now()`,
      [lessonId, body, published],
    )
    : exec(`delete from lesson_texts where lesson_id = $1`, [lessonId]);

export const writeLessonTranscript = (_a: string, lessonId: string, body: string): Promise<DbError> =>
  body
    ? exec(
      `insert into lesson_transcripts (lesson_id, body, updated_at) values ($1, $2, now())
       on conflict (lesson_id) do update set body = excluded.body, updated_at = now()`,
      [lessonId, body],
    )
    : exec(`delete from lesson_transcripts where lesson_id = $1`, [lessonId]);

export const setPublished = (_a: string, id: string, published: boolean): Promise<Found> =>
  found(`update lessons set published = $2 where id = $1 returning id`, [id, published]);
export const removeLesson = (_a: string, id: string): Promise<DbError> => exec(`delete from lessons where id = $1`, [id]);
export const linkLessonToModule = (a: string, lessonId: string, moduleId: string): Promise<DbError> =>
  exec(`select admin_link_lesson($1, $2, $3)`, [a, moduleId, lessonId]);
export const unlinkLessonFromModule = (_a: string, lessonId: string, moduleId: string): Promise<DbError> =>
  exec(`delete from module_lessons where module_id = $1 and lesson_id = $2`, [moduleId, lessonId]);
export const listModuleLessonIds = (_a: string, moduleId: string) =>
  ids(`select lesson_id as id from module_lessons where module_id = $1 order by position, lesson_id`, [moduleId]);
export const reorderModuleLessons = (a: string, moduleId: string, list: string[]): Promise<DbError> =>
  exec(`select admin_reorder_module_lessons($1, $2, $3::text[])`, [a, moduleId, list]);

// ---------- módulos ----------
export const renameModule = (_a: string, id: string, title: string): Promise<Found> =>
  found(`update modules set title = $2 where id = $1 returning id`, [id, title]);
export const insertModule = (_a: string, trackId: string, title: string) =>
  created(
    `insert into modules (track_id, title, position)
     select $1, $2, coalesce(max(position), 0) + 1 from modules where track_id = $1 returning id`,
    [trackId, title],
  );
export const removeModule = (_a: string, id: string): Promise<DbError> => exec(`delete from modules where id = $1`, [id]);
export async function getModuleTrackId(_a: string, id: string): Promise<string | null> {
  return (await one<{ track_id: string }>(`select track_id from modules where id = $1`, [id]))?.track_id ?? null;
}
export const listTrackModuleIds = (_a: string, trackId: string) =>
  ids(`select id from modules where track_id = $1 order by position, id`, [trackId]);
export const reorderModules = (a: string, trackId: string, list: string[]): Promise<DbError> =>
  exec(`select admin_reorder_modules($1, $2, $3::uuid[])`, [a, trackId, list]);

// ---------- novidades ----------
export const updateNewsRow = (_a: string, id: string, r: NewsInput): Promise<Found> =>
  found(
    `update news set title = $2, description = $3, href = $4, published = $5 where id = $1 returning id`,
    [id, r.title, r.description, r.href, r.published],
  );
export const insertNews = (_a: string, r: NewsInput) =>
  created(
    `insert into news (title, description, href, published, position)
     select $1, $2, $3, $4, coalesce(max(position), 0) + 1 from news returning id`,
    [r.title, r.description, r.href, r.published],
  );
export const removeNews = (_a: string, id: string): Promise<DbError> => exec(`delete from news where id = $1`, [id]);
export const listNewsIds = (_a: string) => ids(`select id from news order by position, id`);
export const reorderNews = (a: string, list: string[]): Promise<DbError> =>
  exec(`select admin_reorder_news($1, $2::uuid[])`, [a, list]);

// ---------- dúvidas e quiz ----------
/** Grava a resposta e zera answer_seen_at (o aluno vê o destaque de nova resposta). */
export const writeAnswer = (_a: string, id: string, answer: string, answeredBy: string): Promise<Found> =>
  found(
    `update lesson_questions set answer = $2, answered_at = now(), answered_by = $3, answer_seen_at = null where id = $1 returning id`,
    [id, answer, answeredBy],
  );

export const replaceQuiz = (a: string, moduleId: string, questions: QuizQuestion[]): Promise<DbError> =>
  exec(`select admin_save_quiz($1, $2, $3::jsonb)`, [a, moduleId, JSON.stringify(questions)]);

// ---------- trilhas ----------
export const updateTrackRow = (_a: string, slug: string, r: TrackInput): Promise<Found> =>
  found(
    `update tracks set name = $2, audience = $3, icon = $4, color = $5, pitch = $6, outcomes = $7, published = $8
     where id = $1 returning id`,
    [slug, r.name, r.audience, r.icon, r.color, r.pitch, r.outcomes, r.published],
  );
export const insertTrack = (_a: string, slug: string, r: TrackInput): Promise<DbError> =>
  exec(
    `insert into tracks (id, name, audience, icon, color, pitch, outcomes, published, position)
     select $1, $2, $3, $4, $5, $6, $7, $8, coalesce(max(position), 0) + 1 from tracks`,
    [slug, r.name, r.audience, r.icon, r.color, r.pitch, r.outcomes, r.published],
  );
export const removeTrack = (_a: string, slug: string): Promise<DbError> => exec(`delete from tracks where id = $1`, [slug]);
export const listTrackIds = (_a: string) => ids(`select id from tracks order by position, id`);
export const reorderTracks = (a: string, list: string[]): Promise<DbError> =>
  exec(`select admin_reorder_tracks($1, $2::text[])`, [a, list]);
