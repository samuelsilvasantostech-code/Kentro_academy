// Área do aluno no Postgres real (PGlite via socket): sem RLS, cada função precisa filtrar por aluno e por publicado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { runMigrations } from "./migrate.ts";
import "./test-loader.mjs";

const PORT = 55441;
const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000b1";
const MOD = "00000000-0000-0000-0000-0000000000d1";
const MOD_R = "00000000-0000-0000-0000-0000000000d2";
let pg, server, db;
const q = async (sql, p) => (await pg.query(sql, p)).rows;

before(async () => {
  pg = new PGlite({ extensions: { pgcrypto } });
  await runMigrations({ exec: (s) => pg.exec(s), query: (s, p) => pg.query(s, p) }, path.join(import.meta.dirname, "..", "..", "..", "..", "db", "migrations"), () => {});
  await pg.exec(`
    insert into users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');
    insert into profiles (id, full_name) values ('${A}', 'Aluno A'), ('${B}', 'Aluno B');
    insert into tracks (id, name, published) values ('pub', 'Publicada', true), ('rasc', 'Rascunho', false);
    insert into modules (id, track_id, title) values ('${MOD}', 'pub', 'M1'), ('${MOD_R}', 'rasc', 'MR');
    insert into lessons (id, youtube_id, title, published, key_points) values
      ('aulapub', 'arZ7FinndBU', 'Aula publicada', true, '{um}'), ('aularasc', 'arZ7FinndBV', 'Aula rascunho', false, '{segredo}');
    insert into module_lessons (module_id, lesson_id, position) values ('${MOD}', 'aulapub', 1), ('${MOD}', 'aularasc', 2), ('${MOD_R}', 'aulapub', 1);
    insert into chapters (lesson_id, start_seconds, title) values ('aularasc', 0, 'cap secreto');
    insert into lesson_texts (lesson_id, body, published) values ('aulapub', 'texto rascunho', false), ('aularasc', 'texto da aula rascunho', true);
    insert into quiz_questions (module_id, question, options, correct, explanation, position) values
      ('${MOD}', 'Q1?', '{a,b}', 1, 'porque b', 1), ('${MOD_R}', 'QR?', '{a,b}', 0, 'x', 1);
  `);
  server = new PGLiteSocketServer({ db: pg, port: PORT, maxConnections: 10 });
  await server.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  db = await import("./aluno.ts");
});

after(async () => {
  const { getPool } = await import("./pool.ts");
  await getPool()?.end();
  await server.stop();
});

test("anotação: cada aluno só vê e só apaga a própria", async () => {
  assert.equal(await db.insertNote(A, "aulapub", "nota da A"), null);
  const [nota] = await q(`select id from notes where user_id = $1`, [A]);
  assert.equal((await db.loadNotes(B, 10)).count, 0);
  assert.equal(await db.deleteNoteOf(B, nota.id), null);
  assert.equal((await db.loadNotes(A, 10)).count, 1, "B não apagou a nota da A");
  const page = await db.loadLessonPage({ userId: B, lessonId: "aulapub", moduleIds: [MOD], preview: false });
  assert.deepEqual(page.notes, []);
  await db.deleteNoteOf(A, nota.id);
  assert.equal((await db.loadNotes(A, 10)).count, 0);
});

test("dúvidas e respostas: só do próprio aluno", async () => {
  await db.insertQuestion(A, "aulapub", "dúvida da A");
  await q(`update lesson_questions set answer = 'resposta', answered_at = now()`);
  assert.equal((await db.loadUnseenAnswers(B, 10)).length, 0);
  assert.equal((await db.loadUnseenAnswers(A, 10)).length, 1);
  await db.markAnswersSeenOf(B, "aulapub");
  assert.equal((await db.loadUnseenAnswers(A, 10)).length, 1, "B não marca a resposta da A");
  await db.markAnswersSeenOf(A, "aulapub");
  assert.equal((await db.loadUnseenAnswers(A, 10)).length, 0);
});

test("aula em rascunho não entrega nada ao aluno (só na pré-visualização do admin)", async () => {
  const aluno = await db.loadLessonPage({ userId: A, lessonId: "aularasc", moduleIds: [MOD], preview: false });
  assert.deepEqual([aluno.chapters, aluno.keyPoints, aluno.article], [[], [], null]);
  const admin = await db.loadLessonPage({ userId: A, lessonId: "aularasc", moduleIds: [MOD], preview: true });
  assert.equal(admin.chapters.length, 1);
  assert.deepEqual(admin.article, { md: "texto da aula rascunho", draft: false });
  const pub = await db.loadLessonPage({ userId: A, lessonId: "aulapub", moduleIds: [MOD], preview: false });
  assert.equal(pub.article, null, "texto em rascunho de aula publicada não aparece");
  assert.deepEqual(pub.keyPoints, ["um"]);
});

test("progresso: não marca aula em rascunho e repetir não é erro", async () => {
  assert.equal(await db.insertLessonDone(A, "aularasc"), null);
  assert.equal(await db.insertLessonDone(A, "aulapub"), null);
  assert.equal(await db.insertLessonDone(A, "aulapub"), null);
  assert.deepEqual(await db.listDoneLessonIds(A), ["aulapub"]);
  assert.deepEqual(await db.listDoneLessonIds(B), []);
});

test("quiz: aluno nunca recebe gabarito, nem pergunta de trilha em rascunho", async () => {
  const quiz = await db.loadQuizForStudent(MOD);
  assert.deepEqual(quiz.questions, [{ question: "Q1?", options: ["a", "b"] }]);
  assert.ok(!JSON.stringify(quiz).includes("porque b"));
  assert.deepEqual((await db.loadQuizForStudent(MOD_R)).questions, []);

  const errou = await db.submitQuizAnswersFor(A, MOD, [0]);
  assert.equal(errou.error, null);
  assert.equal(errou.data.passed, false);
  assert.equal(errou.data.correct, undefined, "reprovado não recebe gabarito");
  assert.equal(errou.data.explanations, undefined);
  await q(`update quiz_attempts set created_at = now() - interval '1 minute'`);
  const passou = await db.submitQuizAnswersFor(A, MOD, [1]);
  assert.equal(passou.data.passed, true);
  const [{ n }] = await q(`select count(*)::int n from quiz_attempts where user_id = $1`, [B]);
  assert.equal(n, 0);
});

test("certificado: só com a trilha concluída, emitido uma vez, data em texto ISO", async () => {
  assert.equal(await db.issueCertificate(B, "pub"), null, "B não concluiu");
  const c = await db.trackCompletionFor(A, "pub");
  assert.equal(c.completed, true);
  assert.equal(typeof c.completed_at, "string");
  const at = await db.issueCertificate(A, "pub");
  assert.match(at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(await db.issueCertificate(A, "pub"), at);
  assert.deepEqual([...(await db.listCertificates(A)).keys()], ["pub"]);
  assert.equal((await db.listCertificates(B)).size, 0);
});

test("vídeo, perfil e novidades", async () => {
  await db.saveVideoPositionOf(A, "aulapub", 125.7, 600);
  assert.equal((await db.loadLessonPage({ userId: A, lessonId: "aulapub", moduleIds: [], preview: false })).serverAt, 125);
  assert.equal((await db.loadLessonPage({ userId: B, lessonId: "aulapub", moduleIds: [], preview: false })).serverAt, null);
  await db.saveVideoPositionOf(A, "aulapub", 595, 600);
  assert.equal((await db.loadLessonPage({ userId: A, lessonId: "aulapub", moduleIds: [], preview: false })).serverAt, null);

  await db.updateProfileName(A, "Novo Nome");
  const s = await db.loadStudentState(A);
  assert.equal(s.profile.full_name, "Novo Nome");
  assert.equal((await db.loadStudentState(B)).profile.full_name, "Aluno B");

  await q(`insert into news (title, published, position) values ('vis', true, 1), ('oculta', false, 0)`);
  assert.deepEqual((await db.loadPublishedNews(10)).map((n) => n.title), ["vis"]);
});

test("busca e textos: só aula publicada", async () => {
  const hits = await db.searchLessonsRpc("aula", ["aula"]);
  assert.deepEqual(hits.map((h) => h.id), ["aulapub"]);
  assert.equal((await db.loadPublishedTexts()).size, 0);
  await q(`update lesson_texts set published = true where lesson_id = 'aulapub'`);
  assert.deepEqual([...(await db.loadPublishedTexts(["aulapub", "aularasc"])).keys()], ["aulapub"]);
});

test("catálogo: aula em rascunho nunca entra; trilha em rascunho só na pré-visualização", async () => {
  const cat = await db.loadPreviewCatalog();
  assert.deepEqual(cat.map((t) => t.id), ["pub", "rasc"]);
  assert.deepEqual(cat[0].modules[0].lessons.map((l) => l.id), ["aulapub"]);
  assert.ok(!JSON.stringify(cat).includes("published"), "formato igual ao do Supabase");
});
