// Copia todos os dados do Supabase para o Postgres do Doca e confere tabela por tabela.
//
// Uso (na pasta app):
//   node --env-file=.env.migracao scripts/migrar-dados.mjs              copia e confere
//   node --env-file=.env.migracao scripts/migrar-dados.mjs --conferir   só confere
//
// .env.migracao (NUNCA vai para o git; .env* já está no .gitignore):
//   SUPABASE_DB_URL=postgresql://...supabase.com:5432/postgres     (origem: Supabase › Settings › Database)
//   DATABASE_URL=postgresql://...                                    (destino: banco do Doca)
//   TRANSCRICOES_DIR=../transcricoes                                 (opcional; usado se o Supabase ainda não tiver a 0009)
//
// Idempotente: aplica as migrações no destino e recarrega TUDO numa transação só (se algo falhar, o destino
// fica como estava). Sessões abertas no Doca caem (os usuários são recarregados). Origem só é lida.
// Usuários vêm de auth.users com o mesmo id e o mesmo hash bcrypt: a senha de cada aluno continua a mesma.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { runMigrations } from "../src/lib/db/pg/migrate.ts";

const ONLY_CHECK = process.argv.includes("--conferir");

// Ordem de carga (pais antes de filhos). users é tratado à parte.
const TABLES = [
  "tracks", "modules", "lessons", "module_lessons", "chapters", "materials", "lesson_texts", "quiz_questions",
  "news", "profiles", "lesson_progress", "video_progress", "quiz_attempts", "notes", "lesson_questions",
  "track_certificates", "lesson_transcripts",
];

const USERS_SQL = `
  select id, lower(btrim(email)) as email, nullif(encrypted_password, '') as password_hash,
         email_confirmed_at, created_at, coalesce(updated_at, created_at) as updated_at,
         case when banned_until > now() or deleted_at is not null then now() end as disabled_at
    from auth.users where email is not null`;

const USERS_CHECK_SQL = `
  select id, lower(btrim(email)) as email, nullif(encrypted_password, '') as password_hash,
         email_confirmed_at, created_at, coalesce(updated_at, created_at) as updated_at
    from auth.users where email is not null`;

function pool(url, name) {
  if (!url) throw new Error(`${name} não definido (veja o topo do script)`);
  const u = new URL(url);
  const ssl = u.searchParams.get("sslmode");
  u.searchParams.delete("sslmode");
  // Supabase exige TLS com certificado da própria CA; a conexão é só de leitura e feita uma vez.
  return new pg.Pool({
    connectionString: u.toString(),
    ssl: ssl && ssl !== "disable" ? { rejectUnauthorized: false } : undefined,
    max: 2,
    connectionTimeoutMillis: 10_000,
  });
}

async function json(db, sql) {
  const { rows } = await db.query(`select coalesce(json_agg(t), '[]')::text as j from (${sql}) t`);
  return rows[0].j;
}

async function tableExists(db, table, schema = "public") {
  const { rows } = await db.query("select to_regclass($1) is not null as ok", [`${schema}.${table}`]);
  return rows[0].ok;
}

async function columns(db, table) {
  const { rows } = await db.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
    [table],
  );
  return rows.map((r) => r.column_name);
}

/** Linhas do Supabase para a tabela, só com as colunas que existem nos dois lados. */
async function sourceRows(src, dst, table) {
  if (!(await tableExists(src, table))) return null;
  const [a, b] = await Promise.all([columns(src, table), columns(dst, table)]);
  const cols = b.filter((c) => a.includes(c)).map((c) => `"${c}"`).join(", ");
  return { cols, json: await json(src, `select ${cols} from public.${table}`) };
}

async function transcriptsFromFolder(src) {
  const dir = path.resolve(process.env.TRANSCRICOES_DIR || "../transcricoes");
  const ids = new Set((await src.query("select id from public.lessons")).rows.map((r) => r.id));
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".txt"));
  const rows = [];
  for (const f of files) {
    const id = f.slice(0, -4);
    if (!ids.has(id)) continue;
    rows.push({ lesson_id: id, body: (await readFile(path.join(dir, f), "utf8")).slice(0, 200_000) });
  }
  console.log(`  transcrições: ${rows.length} arquivos de ${dir}`);
  return { cols: "lesson_id, body", json: JSON.stringify(rows) };
}

/** Assinatura de uma tabela para comparar origem e destino: contagem + md5 das linhas ordenadas. */
async function signature(pool, sql) {
  const db = await pool.connect();
  try {
    await db.query("set timezone = 'UTC'");
    const { rows } = await db.query(
    `select count(*)::int as n, coalesce(md5(string_agg(r, '|' order by r)), '') as h from (select row(t.*)::text as r from (${sql}) t) x`,
    );
    return rows[0];
  } finally {
    db.release();
  }
}

async function check(src, dst) {
  let ok = true;
  const report = [];
  const pairs = [["users", USERS_CHECK_SQL, "select id, email, password_hash, email_confirmed_at, created_at, updated_at from users"]];
  for (const t of TABLES) {
    if (!(await tableExists(src, t))) continue;
    const [a, b] = await Promise.all([columns(src, t), columns(dst, t)]);
    const cols = b.filter((c) => a.includes(c)).map((c) => `"${c}"`).join(", ");
    pairs.push([t, `select ${cols} from public.${t}`, `select ${cols} from ${t}`]);
  }
  for (const [name, s, d] of pairs) {
    const [x, y] = await Promise.all([signature(src, s), signature(dst, d)]);
    const same = x.n === y.n && x.h === y.h;
    ok &&= same;
    report.push({ tabela: name, supabase: x.n, doca: y.n, confere: same ? "sim" : "NÃO" });
  }
  console.table(report);
  return ok;
}

async function main() {
  const src = pool(process.env.SUPABASE_DB_URL, "SUPABASE_DB_URL");
  const dst = pool(process.env.DATABASE_URL, "DATABASE_URL");
  try {
    const c = await dst.connect();
    try {
      await c.query("set timezone = 'UTC'");
      await runMigrations({ exec: (sql) => c.query(sql), query: (sql, p) => c.query(sql, p) });
      if (!ONLY_CHECK) {
        console.log("Copiando do Supabase para o Doca…");
        await c.query("begin");
        try {
          await c.query(`truncate users, tracks, lessons, news restart identity cascade`);
          const users = await json(src, USERS_SQL);
          await c.query(
            `insert into users (id, email, password_hash, email_confirmed_at, created_at, updated_at, disabled_at)
             select id, email, password_hash, email_confirmed_at, created_at, updated_at, disabled_at
               from json_populate_recordset(null::users, $1::json)`,
            [users],
          );
          console.log(`  users: ${JSON.parse(users).length}`);
          for (const t of TABLES) {
            let data = await sourceRows(src, c, t);
            if (!data && t === "lesson_transcripts") data = await transcriptsFromFolder(src);
            if (!data) continue;
            const r = await c.query(
              `insert into ${t} (${data.cols}) select ${data.cols} from json_populate_recordset(null::${t}, $1::json)`,
              [data.json],
            );
            console.log(`  ${t}: ${r.rowCount}`);
          }
          await c.query("commit");
        } catch (err) {
          await c.query("rollback");
          throw err;
        }
      }
    } finally {
      c.release();
    }
    const ok = await check(src, dst);
    console.log(ok ? "\nTudo confere." : "\nATENÇÃO: há tabelas que não conferem (veja acima).");
    process.exitCode = ok ? 0 : 1;
  } finally {
    await Promise.all([src.end(), dst.end()]);
  }
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exitCode = 1;
});
