import { Pool } from "pg";
import { withAdmin } from "./guard";
import { getPool } from "../pg/pool";
import { checkAll, copyAll, poolConfig, type CheckLine, type CopyLine } from "../pg/copiar";

/**
 * Cópia única dos dados do Supabase para o banco do Doca, feita de dentro do Doca (o banco não aceita conexão de fora).
 * Só existe com MIGRACAO_ORIGEM_URL (connection string do Supabase) e DATABASE_URL no ambiente.
 * Depois da virada, remover MIGRACAO_ORIGEM_URL desliga a tela.
 */
export const migracaoDisponivel = withAdmin((): boolean => !!process.env.MIGRACAO_ORIGEM_URL && !!getPool());

export type MigracaoResult =
  | { ok: true; copiadas?: CopyLine[]; conferencia: CheckLine[] }
  | { ok: false; erro: string };

async function withSource<T>(fn: (src: Pool, dst: Pool) => Promise<T>): Promise<T> {
  const dst = getPool();
  const url = process.env.MIGRACAO_ORIGEM_URL;
  if (!dst || !url) throw new Error("migração não configurada (MIGRACAO_ORIGEM_URL e DATABASE_URL)");
  const src = new Pool(poolConfig(url));
  try {
    return await fn(src, dst);
  } finally {
    await src.end().catch(() => {});
  }
}

function failure(err: unknown): MigracaoResult {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[migracao]", msg);
  return { ok: false, erro: msg };
}

export const copiarDados = withAdmin(async (): Promise<MigracaoResult> => {
  try {
    return await withSource(async (src, dst) => {
      const copiadas = await copyAll(src, dst);
      return { ok: true as const, copiadas, conferencia: await checkAll(src, dst) };
    });
  } catch (err) {
    return failure(err);
  }
});

export const conferirDados = withAdmin(async (): Promise<MigracaoResult> => {
  try {
    return await withSource(async (src, dst) => ({ ok: true as const, conferencia: await checkAll(src, dst) }));
  } catch (err) {
    return failure(err);
  }
});
