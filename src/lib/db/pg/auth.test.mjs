// Login próprio contra Postgres real (PGlite): senha bcrypt do Supabase, sessão, limite, links de uso único.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { runMigrations } from "./migrate.ts";
import * as auth from "./auth-core.ts";

const SECRET = "s".repeat(40);
const dir = path.join(import.meta.dirname, "..", "..", "..", "..", "db", "migrations");
let pg;
const db = { query: (sql, p) => pg.query(sql, p) };
const ALUNO = "00000000-0000-0000-0000-0000000000a1";
const DESATIVADO = "00000000-0000-0000-0000-0000000000a2";

before(async () => {
  pg = new PGlite({ extensions: { pgcrypto } });
  await runMigrations({ exec: (s) => pg.exec(s), query: (s, p) => pg.query(s, p) }, dir, () => {});
  // Hash no formato do Supabase ($2a$10$): o aluno entra com a senha de sempre.
  const hash = bcrypt.hashSync("senha-antiga", 10).replace(/^\$2b\$/, "$2a$");
  await pg.query(
    `insert into users (id, email, password_hash, email_confirmed_at, disabled_at) values
     ($1, 'aluno@x.com', $3, now(), null), ($2, 'fora@x.com', $3, now(), now())`,
    [ALUNO, DESATIVADO, hash],
  );
});

test("entra com a senha do Supabase, e-mail sem diferença de maiúsculas, e a sessão vale", async () => {
  const r = await auth.login(db, "  Aluno@X.com ", "senha-antiga", "1.1.1.1", SECRET);
  assert.equal(r.ok, true);
  assert.deepEqual(await auth.sessionUser(db, r.token, SECRET), { id: ALUNO, email: "aluno@x.com" });
  const [{ n }] = (await pg.query(`select count(*)::int n from sessions where token_hash = $1`, [r.token])).rows;
  assert.equal(n, 0, "token cru nunca vai para o banco");
  await auth.deleteSession(db, r.token, SECRET);
  assert.equal(await auth.sessionUser(db, r.token, SECRET), null);
});

test("senha errada, e-mail inexistente e conta desativada dão o mesmo erro", async () => {
  for (const [e, p] of [["aluno@x.com", "errada"], ["ninguem@x.com", "senha-antiga"], ["fora@x.com", "senha-antiga"]]) {
    const r = await auth.login(db, e, p, "2.2.2.2", SECRET);
    assert.deepEqual(r, { ok: false, reason: "invalid_credentials" });
  }
});

test("5 erros no mesmo e-mail bloqueiam por 15 minutos, até com a senha certa", async () => {
  await pg.query(`delete from login_attempts`);
  for (let i = 0; i < 5; i++) await auth.login(db, "aluno@x.com", "errada", `9.9.9.${i}`, SECRET);
  assert.deepEqual(await auth.login(db, "aluno@x.com", "senha-antiga", "3.3.3.3", SECRET), { ok: false, reason: "rate_limited" });
  await pg.query(`update login_attempts set at = now() - interval '16 minutes'`);
  assert.equal((await auth.login(db, "aluno@x.com", "senha-antiga", "3.3.3.3", SECRET)).ok, true);
});

test("sessão vencida ou de conta desativada não vale", async () => {
  const t = await auth.createSession(db, ALUNO, SECRET);
  await pg.query(`update sessions set expires_at = now() - interval '1 second' where token_hash = $1`, [auth.hashToken(t, SECRET)]);
  assert.equal(await auth.sessionUser(db, t, SECRET), null);
  const t2 = await auth.createSession(db, DESATIVADO, SECRET);
  assert.equal(await auth.sessionUser(db, t2, SECRET), null);
});

test("link de redefinição: só para conta ativa, uso único, e a nova senha derruba as outras sessões", async () => {
  assert.equal(await auth.createResetToken(db, "ninguem@x.com", SECRET), null);
  assert.equal(await auth.createResetToken(db, "fora@x.com", SECRET), null);
  const outra = await auth.createSession(db, ALUNO, SECRET);
  const { token } = await auth.createResetToken(db, "ALUNO@x.com", SECRET);
  assert.equal(await auth.consumeToken(db, token, "invite", SECRET), null, "propósito errado não serve");
  assert.equal(await auth.consumeToken(db, token, "reset", SECRET), ALUNO);
  assert.equal(await auth.consumeToken(db, token, "reset", SECRET), null, "segunda vez não serve");

  const atual = await auth.createSession(db, ALUNO, SECRET);
  assert.equal(await auth.changePassword(db, ALUNO, "senha-antiga", atual, SECRET), "same_password");
  assert.equal(await auth.changePassword(db, ALUNO, "curta", atual, SECRET), "weak_password");
  assert.equal(await auth.changePassword(db, ALUNO, "senha-nova-123", atual, SECRET), "ok");
  assert.equal(await auth.sessionUser(db, outra, SECRET), null);
  assert.equal((await auth.sessionUser(db, atual, SECRET))?.id, ALUNO);
  await pg.query(`delete from login_attempts`);
  assert.equal((await auth.login(db, "aluno@x.com", "senha-nova-123", null, SECRET)).ok, true);
  assert.equal((await auth.login(db, "aluno@x.com", "senha-antiga", null, SECRET)).ok, false);
});

test("link de redefinição vence e tem limite de 3 por hora", async () => {
  await pg.query(`delete from auth_tokens`);
  const { token } = await auth.createResetToken(db, "aluno@x.com", SECRET);
  await pg.query(`update auth_tokens set expires_at = now() - interval '1 second'`);
  assert.equal(await auth.consumeToken(db, token, "reset", SECRET), null);
  await auth.createResetToken(db, "aluno@x.com", SECRET);
  await auth.createResetToken(db, "aluno@x.com", SECRET);
  assert.equal(await auth.createResetToken(db, "aluno@x.com", SECRET), null);
});

test("AUTH_SECRET curta é recusada", () => {
  const old = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "curta";
  assert.throws(() => auth.authSecret(), /AUTH_SECRET/);
  process.env.AUTH_SECRET = old;
});
