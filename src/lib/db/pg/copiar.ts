import type { Pool, PoolClient } from "pg";

/**
 * Cópia Supabase -> Postgres do Doca. Usada pelo script (scripts/migrar-dados.mjs) e pela tela /admin/migracao.
 * Idempotente: recarrega TUDO numa transação só (se falhar, o destino fica como estava). A origem só é lida.
 * Usuários vêm de auth.users com o mesmo id e o mesmo hash bcrypt: a senha de cada aluno continua a mesma.
 * Sem sintaxe exclusiva do TypeScript além de tipos: o script roda este arquivo direto no Node.
 */

// Ordem de carga (pais antes de filhos). users é tratado à parte.
export const TABLES = [
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

type Q = Pool | PoolClient;
export type Transcript = { lesson_id: string; body: string };
export type CopyLine = { tabela: string; linhas: number };
export type CheckLine = { tabela: string; origem: number; destino: number; confere: boolean };

/** Lê sslmode da URL: com TLS pedido, aceita o certificado da CA própria do Supabase (conexão de leitura, uma vez). */
export function poolConfig(url: string, max = 2) {
  const u = new URL(url);
  const ssl = u.searchParams.get("sslmode");
  u.searchParams.delete("sslmode");
  return {
    connectionString: u.toString(),
    ssl: ssl && ssl !== "disable" ? { rejectUnauthorized: false } : undefined,
    max,
    connectionTimeoutMillis: 10_000,
  };
}

async function json(db: Q, sql: string): Promise<string> {
  const { rows } = await db.query(`select coalesce(json_agg(t), '[]')::text as j from (${sql}) t`);
  return rows[0].j;
}

async function tableExists(db: Q, table: string, schema = "public"): Promise<boolean> {
  const { rows } = await db.query("select to_regclass($1) is not null as ok", [`${schema}.${table}`]);
  return rows[0].ok;
}

async function columns(db: Q, table: string): Promise<string[]> {
  const { rows } = await db.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
    [table],
  );
  return rows.map((r: { column_name: string }) => r.column_name);
}

async function sharedColumns(src: Q, dst: Q, table: string): Promise<string> {
  const [a, b] = await Promise.all([columns(src, table), columns(dst, table)]);
  return b.filter((c) => a.includes(c)).map((c) => `"${c}"`).join(", ");
}

/** Confere que a origem é mesmo o Supabase (tem auth.users) e o destino não é. */
async function assertRoles(src: Q, dst: Q) {
  if (!(await tableExists(src, "users", "auth"))) throw new Error("a origem não tem auth.users: confira a URL de origem");
  if (await tableExists(dst, "users", "auth")) throw new Error("o destino tem auth.users (parece o Supabase): cópia cancelada");
}

/**
 * Copia tudo. `transcripts` (opcional) é usado só se a origem ainda não tiver a tabela lesson_transcripts.
 * Usa um advisory lock: dois cliques ao mesmo tempo não rodam juntos.
 */
export async function copyAll(src: Pool, dst: Pool, transcripts?: () => Promise<Transcript[]>): Promise<CopyLine[]> {
  await assertRoles(src, dst);
  const c = await dst.connect();
  const out: CopyLine[] = [];
  try {
    const { rows } = await c.query("select pg_try_advisory_lock(820146) as ok");
    if (!rows[0].ok) throw new Error("já existe uma cópia em andamento");
    try {
      await c.query("begin");
      try {
        await c.query("truncate users, tracks, lessons, news restart identity cascade");
        const users = await json(src, USERS_SQL);
        const r = await c.query(
          `insert into users (id, email, password_hash, email_confirmed_at, created_at, updated_at, disabled_at)
           select id, email, password_hash, email_confirmed_at, created_at, updated_at, disabled_at
             from json_populate_recordset(null::users, $1::json)`,
          [users],
        );
        out.push({ tabela: "users", linhas: r.rowCount ?? 0 });
        for (const t of TABLES) {
          let data: { cols: string; json: string } | null = null;
          if (await tableExists(src, t)) {
            const cols = await sharedColumns(src, c, t);
            data = { cols, json: await json(src, `select ${cols} from public.${t}`) };
          } else if (t === "lesson_transcripts" && transcripts) {
            const ids = new Set((await src.query("select id from public.lessons")).rows.map((x: { id: string }) => x.id));
            const list = (await transcripts()).filter((x) => ids.has(x.lesson_id));
            data = { cols: "lesson_id, body", json: JSON.stringify(list) };
          }
          if (!data) continue;
          const ins = await c.query(
            `insert into ${t} (${data.cols}) select ${data.cols} from json_populate_recordset(null::${t}, $1::json)`,
            [data.json],
          );
          out.push({ tabela: t, linhas: ins.rowCount ?? 0 });
        }
        await c.query("commit");
      } catch (err) {
        await c.query("rollback");
        throw err;
      }
    } finally {
      await c.query("select pg_advisory_unlock(820146)").catch(() => {});
    }
  } finally {
    c.release();
  }
  return out;
}

/** Contagem + md5 das linhas ordenadas, com fuso fixo em UTC (datas saem iguais nos dois lados). */
async function signature(pool: Pool, sql: string): Promise<{ n: number; h: string }> {
  const db = await pool.connect();
  try {
    await db.query("set timezone = 'UTC'");
    const { rows } = await db.query(
      `select count(*)::int as n, coalesce(md5(string_agg(r, '|' order by r)), '') as h
         from (select row(t.*)::text as r from (${sql}) t) x`,
    );
    return rows[0];
  } finally {
    db.release();
  }
}

/** Confere tabela por tabela (as que existem na origem). */
export async function checkAll(src: Pool, dst: Pool): Promise<CheckLine[]> {
  await assertRoles(src, dst);
  const pairs: [string, string, string][] = [
    ["users", USERS_CHECK_SQL, "select id, email, password_hash, email_confirmed_at, created_at, updated_at from users"],
  ];
  for (const t of TABLES) {
    if (!(await tableExists(src, t))) continue;
    const cols = await sharedColumns(src, dst, t);
    pairs.push([t, `select ${cols} from public.${t}`, `select ${cols} from ${t}`]);
  }
  const out: CheckLine[] = [];
  for (const [tabela, s, d] of pairs) {
    const [x, y] = await Promise.all([signature(src, s), signature(dst, d)]);
    out.push({ tabela, origem: x.n, destino: y.n, confere: x.n === y.n && x.h === y.h });
  }
  return out;
}
