// Testa db/migrations num Postgres real (PGlite, em memória): esquema sobe, regras críticas valem no banco.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { runMigrations } from "./migrate.ts";

const dir = path.join(import.meta.dirname, "..", "..", "..", "..", "db", "migrations");
let db;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const adapter = () => ({ exec: (sql) => db.exec(sql), query: (sql, params) => db.query(sql, params) });
const ADMIN = "00000000-0000-0000-0000-00000000000a";
const ALUNO = "00000000-0000-0000-0000-00000000000b";
const OUTRO = "00000000-0000-0000-0000-00000000000c";
const MOD = "00000000-0000-0000-0000-0000000000d1";
const MOD_RASCUNHO = "00000000-0000-0000-0000-0000000000d2";

async function expectError(sql, params, code) {
  await assert.rejects(db.query(sql, params), (err) => {
    assert.equal(err.code, code, `esperava ${code}, veio ${err.code}: ${err.message}`);
    return true;
  });
}

before(async () => {
  db = new PGlite({ extensions: { unaccent, pgcrypto } });
  const applied = await runMigrations(adapter(), dir, () => {});
  assert.deepEqual(applied, ["0001_inicial.sql"]);
  await db.exec(`
    insert into users (id, email, password_hash) values
      ('${ADMIN}', 'admin@kentro.com.br', '$2a$10$x'), ('${ALUNO}', 'aluno@empresa.com.br', '$2a$10$y'),
      ('${OUTRO}', 'outro@empresa.com.br', '$2a$10$z');
    insert into profiles (id, full_name, is_admin) values ('${ADMIN}', 'Admin', true), ('${ALUNO}', 'Aluno', false), ('${OUTRO}', 'Outro', false);
    insert into tracks (id, name, published) values ('atendente', 'Atendente pronto para atender', true), ('rascunho', 'Rascunho', false);
    insert into modules (id, track_id, title) values ('${MOD}', 'atendente', 'Primeiros passos'), ('${MOD_RASCUNHO}', 'rascunho', 'R');
    insert into lessons (id, youtube_id, title, summary, published) values
      ('arZ7FinndBU', 'arZ7FinndBU', 'Criar e configurar agentes', 'Cadastre usuários do time', true),
      ('aula2xxxxxx', 'aula2xxxxxx', 'Painel de filas', 'Logar nas filas', true),
      ('rascunhoxxx', 'rascunhoxxx', 'Aula em rascunho sobre agentes', null, false);
    insert into module_lessons (module_id, lesson_id, position) values ('${MOD}', 'arZ7FinndBU', 1), ('${MOD}', 'aula2xxxxxx', 2), ('${MOD}', 'rascunhoxxx', 3);
  `);
  await q(`select admin_save_quiz($1, $2, $3)`, [ADMIN, MOD, JSON.stringify([
    { question: "Onde loga nas filas?", options: ["Painel de filas", "Chat"], correct: 0, explanation: "No painel." },
    { question: "Nota interna?", options: ["Ícone i", "Transferir"], correct: 0, explanation: "Ícone i.", lesson_id: "arZ7FinndBU" },
  ])]);
});

test("migração não roda duas vezes", async () => {
  assert.deepEqual(await runMigrations(adapter(), dir, () => {}), []);
});

test("e-mail único e sempre minúsculo", async () => {
  await expectError(`insert into users (email) values ('Aluno@Empresa.com.br')`, [], "23514");
  await expectError(`insert into users (email) values ('aluno@empresa.com.br')`, [], "23505");
});

test("view do aluno não tem gabarito e esconde trilha rascunho", async () => {
  const cols = (await q(`select column_name from information_schema.columns where table_name = 'quiz_questions_aluno'`)).map((r) => r.column_name);
  assert.ok(!cols.includes("correct") && !cols.includes("explanation"), cols.join(","));
  await q(`insert into quiz_questions (module_id, question, options, correct) values ($1, 'x?', '{a,b}', 1)`, [MOD_RASCUNHO]);
  const rows = await q(`select module_id from quiz_questions_aluno`);
  assert.ok(rows.length === 2 && rows.every((r) => r.module_id === MOD));
});

test("quiz reprovado não devolve gabarito; freio de 20 s", async () => {
  const [{ r }] = await q(`select submit_quiz($1, $2, $3) r`, [ALUNO, MOD, [1, 1]]);
  assert.equal(r.passed, false);
  assert.equal(r.score, 0);
  assert.ok(!("correct" in r) && !("explanations" in r));
  await expectError(`select submit_quiz($1, $2, $3)`, [ALUNO, MOD, [0, 0]], "54000");
});

test("quiz: respostas inválidas e trilha rascunho", async () => {
  await expectError(`select submit_quiz($1, $2, $3)`, [OUTRO, MOD, [0]], "22023");
  await expectError(`select submit_quiz($1, $2, $3)`, [OUTRO, MOD_RASCUNHO, [0]], "P0002");
  await expectError(`select submit_quiz($1, $2, $3)`, [null, MOD, [0, 0]], "42501");
});

test("quiz aprovado devolve gabarito", async () => {
  const [{ r }] = await q(`select submit_quiz($1, $2, $3) r`, [OUTRO, MOD, [0, 0]]);
  assert.equal(r.passed, true);
  assert.deepEqual(r.correct, [0, 0]);
});

test("certificado só com a trilha concluída, e é para sempre", async () => {
  const [{ c0 }] = await q(`select issue_certificate($1, 'atendente') c0`, [OUTRO]);
  assert.equal(c0, null);
  await q(`insert into lesson_progress (user_id, lesson_id) values ($1, 'arZ7FinndBU'), ($1, 'aula2xxxxxx')`, [OUTRO]);
  const [{ c1 }] = await q(`select issue_certificate($1, 'atendente') c1`, [OUTRO]);
  assert.ok(c1 instanceof Date);
  // Aula nova publicada depois não tira o certificado.
  await q(`update lessons set published = true where id = 'rascunhoxxx'`);
  const [{ c2 }] = await q(`select issue_certificate($1, 'atendente') c2`, [OUTRO]);
  assert.equal(c2.getTime(), c1.getTime());
  await q(`update lessons set published = false where id = 'rascunhoxxx'`);
  const [{ c3 }] = await q(`select issue_certificate($1, 'atendente') c3`, [ALUNO]);
  assert.equal(c3, null);
});

test("funções de admin recusam quem não é admin", async () => {
  await expectError(`select admin_save_quiz($1, $2, '[]')`, [ALUNO, MOD], "42501");
  await expectError(`select admin_reorder_tracks($1, '{atendente}')`, [ALUNO], "42501");
  await expectError(`select admin_save_lesson($1, null, $2, '{"title":"x"}')`, [ALUNO, MOD], "42501");
  await expectError(`select admin_link_lesson($1, $2, 'aula2xxxxxx')`, [null, MOD], "42501");
});

test("admin desativado perde o acesso", async () => {
  await q(`update users set disabled_at = now() where id = $1`, [ADMIN]);
  await expectError(`select admin_reorder_news($1, '{}')`, [ADMIN], "42501");
  await q(`update users set disabled_at = null where id = $1`, [ADMIN]);
  await q(`select admin_reorder_news($1, '{}')`, [ADMIN]);
});

test("admin cria aula como rascunho no fim do módulo", async () => {
  const [{ id }] = await q(`select admin_save_lesson($1, null, $2, $3) id`, [ADMIN, MOD, JSON.stringify({
    title: " Nova ", chapters: [{ start_seconds: 0, title: "Início" }], materials: [{ title: "PDF", url: "https://x.com/a.pdf" }],
  })]);
  const [l] = await q(`select title, published from lessons where id = $1`, [id]);
  assert.deepEqual(l, { title: "Nova", published: false });
  const [{ position }] = await q(`select position from module_lessons where lesson_id = $1`, [id]);
  assert.equal(position, 4);
});

test("busca: acento, plural, transcrição e só aula publicada", async () => {
  await q(`insert into lesson_transcripts (lesson_id, body) values ('aula2xxxxxx', 'aqui eu mostro como cadastrar usuários no sistema')`);
  const ix = await q(`select tsv::text t from lesson_transcript_index where lesson_id = 'aula2xxxxxx'`);
  assert.ok(ix.length === 1 && !ix[0].t.includes(":"), "índice sem posições");
  const r1 = await q(`select lesson_id, matched from search_lessons('agentes')`);
  assert.deepEqual(r1.map((r) => r.lesson_id), ["arZ7FinndBU"]);
  assert.equal(r1[0].matched, "title");
  const r2 = await q(`select lesson_id, matched from search_lessons('cadastrar usuario')`);
  assert.ok(r2.some((r) => r.lesson_id === "aula2xxxxxx" && r.matched === "transcript"), JSON.stringify(r2));
  const r3 = await q(`select lesson_id from search_lessons('rascunho')`);
  assert.equal(r3.length, 0);
  await q(`delete from lesson_transcripts where lesson_id = 'aula2xxxxxx'`);
  assert.equal((await q(`select 1 from lesson_transcript_index`)).length, 0);
});

test("respostas vistas: só as do próprio aluno", async () => {
  await q(`insert into lesson_questions (user_id, lesson_id, body, answer) values ($1, 'arZ7FinndBU', 'a?', 'sim'), ($2, 'arZ7FinndBU', 'b?', 'não')`, [ALUNO, OUTRO]);
  await q(`select mark_answers_seen($1, null)`, [ALUNO]);
  const rows = await q(`select user_id, answer_seen_at is not null seen from lesson_questions order by body`);
  assert.deepEqual(rows.map((r) => r.seen), [true, false]);
});

test("trava: não aplica migrações num banco do Supabase (com auth.users)", async () => {
  const supa = new PGlite({ extensions: { unaccent, pgcrypto } });
  await supa.exec("create schema auth; create table auth.users (id uuid primary key)");
  await assert.rejects(
    runMigrations({ exec: (s) => supa.exec(s), query: (s, p) => supa.query(s, p) }, dir, () => {}),
    /Supabase/,
  );
  const { rows } = await supa.query("select to_regclass('public.users') is null as limpo, to_regclass('public.schema_migrations') is null as sm");
  assert.deepEqual(rows[0], { limpo: true, sm: true });
});
