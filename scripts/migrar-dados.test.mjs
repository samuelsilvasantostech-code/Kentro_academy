// Testa scripts/migrar-dados.mjs de ponta a ponta com dois Postgres em memória (PGlite servido por socket):
// "Supabase" (com auth.users) -> "Doca" vazio. Roda o script duas vezes (idempotente) e confere senha e dados.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { runMigrations } from "../src/lib/db/pg/migrate.ts";

const run = promisify(execFile);
const app = path.join(import.meta.dirname, "..");
const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234";

const src = new PGlite({ extensions: { unaccent, pgcrypto } });
const dst = new PGlite({ extensions: { unaccent, pgcrypto } });
const servers = [
  new PGLiteSocketServer({ db: src, port: 55431, maxConnections: 10 }),
  new PGLiteSocketServer({ db: dst, port: 55432, maxConnections: 10 }),
];
after(() => Promise.all(servers.map((s) => s.stop())));

test("copia tudo do Supabase para o Doca, mantendo senha, e é idempotente", { timeout: 120_000 }, async () => {
  // Origem: mesmo esquema público + auth.users no formato do Supabase.
  await runMigrations({ exec: (s) => src.exec(s), query: (s, p) => src.query(s, p) }, path.join(app, "db", "migrations"), () => {});
  await src.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, encrypted_password text, email_confirmed_at timestamptz,
      created_at timestamptz, updated_at timestamptz, banned_until timestamptz, deleted_at timestamptz);
    insert into auth.users values
      ('${U1}', 'Samuel@Kentro.com.br', '${HASH}', now(), now() - interval '10 days', null, null, null),
      ('${U2}', 'aluno@empresa.com.br', '', null, now(), now(), 'infinity', null);
    insert into users (id, email) values ('${U1}', 'samuel@kentro.com.br'), ('${U2}', 'aluno@empresa.com.br');
    insert into profiles (id, full_name, is_admin) values ('${U1}', 'Samuel', true), ('${U2}', 'Aluno', false);
    insert into tracks (id, name, outcomes) values ('atendente', 'Atendente', '{"Atender bem","Transferir"}');
    insert into lessons (id, youtube_id, title, steps) values ('arZ7FinndBU', 'arZ7FinndBU', 'Treinamento', '{a,b}');
    insert into lesson_texts (lesson_id, body, published) values ('arZ7FinndBU', 'Texto com "aspas" e ação', true);
    insert into notes (user_id, lesson_id, body) values ('${U2}', 'arZ7FinndBU', 'minha nota');
    insert into lesson_progress (user_id, lesson_id) values ('${U2}', 'arZ7FinndBU');
    insert into lesson_transcripts (lesson_id, body) values ('arZ7FinndBU', 'como cadastrar usuários');
  `);
  await Promise.all(servers.map((s) => s.start()));

  const env = {
    ...process.env,
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:55431/postgres",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
  };
  for (let i = 0; i < 2; i++) {
    const { stdout } = await run(process.execPath, ["scripts/migrar-dados.mjs"], { cwd: app, env });
    assert.match(stdout, /Tudo confere\./, stdout);
  }

  const users = (await dst.query(`select id, email, password_hash, disabled_at is not null as off from users order by email`)).rows;
  assert.deepEqual(users, [
    { id: U2, email: "aluno@empresa.com.br", password_hash: null, off: true },
    { id: U1, email: "samuel@kentro.com.br", password_hash: HASH, off: false },
  ]);
  const [t] = (await dst.query(`select outcomes from tracks`)).rows;
  assert.deepEqual(t.outcomes, ["Atender bem", "Transferir"]);
  const [x] = (await dst.query(`select body from lesson_texts`)).rows;
  assert.equal(x.body, 'Texto com "aspas" e ação');
  assert.equal((await dst.query(`select 1 from notes`)).rows.length, 1);
  assert.equal((await dst.query(`select 1 from lesson_transcript_index`)).rows.length, 1, "índice de busca gerado pelo gatilho");

  // --conferir acusa diferença quando o destino muda.
  await dst.query(`delete from notes`);
  await assert.rejects(run(process.execPath, ["scripts/migrar-dados.mjs", "--conferir"], { cwd: app, env }), (err) => {
    assert.match(err.stdout, /não conferem/);
    return true;
  });
});
