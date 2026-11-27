import { Pool } from "pg";

/**
 * Conexão com o Postgres do Doca: só DATABASE_URL.
 * NÃO usar POSTGRES_URL: a integração Supabase↔Vercel cria essa variável apontando para o banco do Supabase.
 * Sem a variável, o app segue no Supabase como hoje (a troca é por DATA_BACKEND na etapa 3).
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

// Um pool por processo, mesmo com recarga de módulos no dev.
const g = globalThis as unknown as { __kentroPool?: Pool };

export function getPool(): Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!g.__kentroPool) {
    g.__kentroPool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
    });
    // Erro numa conexão ociosa (banco reiniciou) não derruba o processo.
    g.__kentroPool.on("error", (err) => console.error("[db] conexão perdida:", err.message));
  }
  return g.__kentroPool;
}

export type DbStatus = "ok" | "nao_configurado" | "erro";

export async function dbStatus(): Promise<DbStatus> {
  const pool = getPool();
  if (!pool) return "nao_configurado";
  try {
    // Responde em até 2 s: o healthcheck do Doca desiste em 5 s.
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2_000)),
    ]);
    return "ok";
  } catch {
    return "erro";
  }
}
