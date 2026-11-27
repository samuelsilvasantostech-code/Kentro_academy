// Admin no Postgres real (PGlite via socket): cada tela do /admin lê e grava; funções do banco recusam quem não é admin.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { runMigrations } from "./migrate.ts";
import "./test-loader.mjs";

const PORT = 55442;
const ADM = "00000000-0000-0000-0000-00000000000a";
const ALU = "00000000-0000-0000-0000-00000000000b";
let pg, server, db;
const q = async (sql, p) => (await pg.query(sql, p)).rows;

before(async () => {
  pg = new PGlite({ extensions: { pgcrypto } });
  await runMigrations({ exec: (s) => pg.exec(s), query: (s, p) => pg.query(s, p) }, path.join(import.meta.dirname, "..", "..", "..", "..", "db", "migrations"), () => {});
  await pg.exec(`
    insert into users (id, email) values ('${ADM}', 'adm@x.com'), ('${ALU}', 'alu@x.com');
    insert into profiles (id, full_name, is_admin, company) values ('${ADM}', 'Admin', true, null), ('${ALU}', 'Aluno', false, 'ACME');
  `);
  server = new PGLiteSocketServer({ db: pg, port: PORT, maxConnections: 10 });
  await server.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  db = await import("./admin.ts");
});

after(async () => {
  const { getPool } = await import("./pool.ts");
  await getPool()?.end();
  await server.stop();
});

const track = { name: "Trilha", audience: "", icon: "📘", color: "#8B5CF6", pitch: "", outcomes: ["x"], published: false };
let MOD, MOD2;

test("trilhas e módulos: criar no fim, editar, reordenar", async () => {
  assert.equal(await db.insertTrack(ADM, "um", track), null);
  assert.equal(await db.insertTrack(ADM, "dois", { ...track, name: "Dois" }), null);
  assert.deepEqual((await db.listTrackIds(ADM)).ids, ["um", "dois"]);
  assert.equal((await db.insertTrack(ADM, "um", track))?.code, "23505", "slug repetido");
  assert.deepEqual(await db.updateTrackRow(ADM, "um", { ...track, name: "Um", published: true }), { found: true, error: null });
  assert.equal((await db.updateTrackRow(ADM, "nao-existe", track)).found, false);
  assert.equal(await db.reorderTracks(ADM, ["dois", "um"]), null);
  assert.deepEqual((await db.listTrackIds(ADM)).ids, ["dois", "um"]);
  assert.equal((await db.reorderTracks(ALU, ["um", "dois"]))?.code, "42501", "aluno não reordena");

  MOD = (await db.insertModule(ADM, "um", "Módulo A")).id;
  MOD2 = (await db.insertModule(ADM, "um", "Módulo B")).id;
  assert.ok(MOD && MOD2);
  assert.equal(await db.getModuleTrackId(ADM, MOD), "um");
  assert.equal(await db.reorderModules(ADM, "um", [MOD2, MOD]), null);
  assert.deepEqual((await db.listTrackModuleIds(ADM, "um")).ids, [MOD2, MOD]);
  assert.equal((await db.renameModule(ADM, MOD, "Módulo A1")).found, true);
});

test("aulas: criar como rascunho, editar com capítulos e materiais, publicar, vincular", async () => {
  const input = {
    youtube_id: "arZ7FinndBU", title: "Aula", summary: "resumo", duration_seconds: 120, steps: ["p1"],
    chapters: [{ start_seconds: 0, title: "Início" }], materials: [{ title: "PDF", url: "https://x.com/a.pdf", description: null }],
  };
  assert.equal((await db.saveLessonRpc(ALU, null, MOD, input)).error?.code, "42501", "aluno não cria aula");
  const { id, error } = await db.saveLessonRpc(ADM, null, MOD, input);
  assert.equal(error, null);
  assert.equal(id, "arZ7FinndBU");
  assert.deepEqual(await db.findLessonByYoutubeId(ADM, "arZ7FinndBU"), { id, title: "Aula" });
  await db.setLessonKeyPoints(ADM, id, ["k1"]);
  await db.writeLessonText(ADM, id, "texto", true);
  await db.writeLessonTranscript(ADM, id, "transcrição");
  assert.deepEqual(await db.setPublished(ADM, id, true), { found: true, error: null });
  assert.equal(await db.linkLessonToModule(ADM, id, MOD2), null);

  const d = await db.loadAdminLesson(ADM, id);
  assert.equal(d.published, true);
  assert.deepEqual(d.chapters, [{ start_seconds: 0, title: "Início" }]);
  assert.deepEqual(d.materials, [{ title: "PDF", url: "https://x.com/a.pdf", description: null }]);
  assert.deepEqual(d.key_points, ["k1"]);
  assert.deepEqual(d.text, { body: "texto", published: true });
  assert.equal(d.transcript, "transcrição");
  assert.deepEqual(d.links.map((l) => l.moduleId).sort(), [MOD, MOD2].sort());
  assert.equal(await db.loadAdminLesson(ADM, "nada"), null);

  const list = await db.loadAdminLessons(ADM);
  assert.equal(list.length, 1);
  assert.equal(typeof list[0].created_at, "string");

  await db.writeLessonText(ADM, id, "", false);
  assert.deepEqual((await db.loadAdminLesson(ADM, id)).text, { body: "", published: false });
  assert.equal(await db.unlinkLessonFromModule(ADM, id, MOD2), null);
  assert.deepEqual((await db.listModuleLessonIds(ADM, MOD2)).ids, []);
});

test("árvore do admin: inclui rascunhos e conta perguntas por módulo", async () => {
  assert.equal((await db.replaceQuiz(ALU, MOD, [{ question: "Q?", options: ["a", "b"], correct: 1, explanation: "e" }]))?.code, "42501");
  assert.equal(await db.replaceQuiz(ADM, MOD, [{ question: "Q?", options: ["a", "b"], correct: 1, explanation: "e" }]), null);
  const quiz = await db.loadAdminQuiz(ADM, MOD);
  assert.equal(quiz.length, 1);
  assert.equal(quiz[0].correct, 1, "admin vê o gabarito");

  const trees = await db.loadAdminTracks(ADM);
  assert.deepEqual(trees.map((t) => t.id), ["dois", "um"]);
  const um = trees.find((t) => t.id === "um");
  const m = um.modules.find((x) => x.id === MOD);
  assert.equal(m.quizCount, 1);
  assert.deepEqual(m.lessons.map((l) => [l.id, l.published, l.position]), [["arZ7FinndBU", true, 1]]);
  assert.ok(!("track_id" in m));
});

test("novidades: criar, editar, reordenar, apagar", async () => {
  const a = (await db.insertNews(ADM, { title: "A", description: null, href: "/x", published: true })).id;
  const b = (await db.insertNews(ADM, { title: "B", description: "d", href: null, published: false })).id;
  assert.equal((await db.insertNews(ADM, { title: "C", description: null, href: "javascript:x", published: true })).error?.code, "23514");
  assert.equal(await db.reorderNews(ADM, [b, a]), null);
  assert.deepEqual((await db.loadAdminNews(ADM)).map((n) => n.title), ["B", "A"]);
  assert.equal((await db.updateNewsRow(ADM, a, { title: "A2", description: null, href: null, published: false })).found, true);
  assert.equal(await db.removeNews(ADM, b), null);
  assert.deepEqual((await db.listNewsIds(ADM)).ids, [a]);
});

test("dúvidas: fila, resposta e contagem", async () => {
  await q(`insert into lesson_questions (user_id, lesson_id, body) values ($1, 'arZ7FinndBU', 'como?')`, [ALU]);
  assert.equal(await db.countPendingQuestions(ADM), 1);
  const [p] = await db.loadQuestions(ADM, "pending", 50);
  assert.deepEqual([p.lesson.title, p.student.full_name, p.student.company], ["Aula", "Aluno", "ACME"]);
  assert.equal((await db.writeAnswer(ADM, p.id, "assim", ADM)).found, true);
  assert.equal(await db.countPendingQuestions(ADM), 0);
  const [r] = await db.loadQuestions(ADM, "answered", 50);
  assert.equal(r.answer, "assim");
});

test("métricas e exclusões", async () => {
  await q(`insert into lesson_progress (user_id, lesson_id) values ($1, 'arZ7FinndBU')`, [ALU]);
  const m = await db.loadMetricsSource(ADM);
  assert.equal(m.profiles.length, 2);
  assert.equal(m.progress.length, 1);
  assert.equal(typeof m.progress[0].completed_at, "string");
  assert.equal(m.pendingQuestions, 0);

  assert.equal(await db.removeLesson(ADM, "arZ7FinndBU"), null);
  assert.equal(await db.removeModule(ADM, MOD2), null);
  assert.equal(await db.removeTrack(ADM, "dois"), null);
  assert.deepEqual((await db.listTrackIds(ADM)).ids, ["um"]);
});
