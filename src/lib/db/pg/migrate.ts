import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Aplica, em ordem e uma única vez, os arquivos .sql de db/migrations (mesmo padrão do ClinFy).
 * Cada arquivo roda numa transação; um advisory lock impede duas instâncias de migrarem juntas.
 * Sem dependência do driver: recebe um adaptador, para rodar igual no pg (app e script) e no PGlite (testes).
 */
export type MigrationDb = {
  /** Vários comandos de uma vez, sem parâmetros. */
  exec(sql: string): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

const LOCK = 820145; // número fixo do advisory lock das migrações do Kentro Academy

export function migrationsDir(): string {
  return path.join(process.cwd(), "db", "migrations");
}

export async function runMigrations(db: MigrationDb, dir = migrationsDir(), log: (msg: string) => void = console.log): Promise<string[]> {
  const applied: string[] = [];
  // Trava de segurança: nunca criar estas tabelas num banco do Supabase (que tem o esquema auth).
  const { rows: guard } = await db.query("select to_regclass('auth.users') is not null as supabase");
  if (guard[0]?.supabase) {
    throw new Error("este banco é do Supabase (tem auth.users): migrações do Doca não são aplicadas aqui");
  }
  await db.query("select pg_advisory_lock($1)", [LOCK]);
  try {
    await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const { rows } = await db.query("select name from schema_migrations");
    const done = new Set(rows.map((r) => String(r.name)));
    const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      await db.exec("begin");
      try {
        await db.exec(sql);
        await db.query("insert into schema_migrations (name) values ($1)", [file]);
        await db.exec("commit");
      } catch (err) {
        await db.exec("rollback");
        throw new Error(`migração ${file} falhou: ${(err as Error).message}`);
      }
      applied.push(file);
      log(`[db] migração aplicada: ${file}`);
    }
  } finally {
    await db.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => {});
  }
  return applied;
}
