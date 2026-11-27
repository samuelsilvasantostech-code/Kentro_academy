import { getPool } from "./pool";
import { isPostgres } from "../backend";
import type { DbError } from "../types";

/** Consulta no Postgres do Doca. Sempre com parâmetros ($1, $2…): nunca concatenar valor no SQL. */
export async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL não configurada");
  return (await pool.query(sql, params)).rows as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await rows<T>(sql, params))[0] ?? null;
}

/** Para gravações: devolve o erro no formato comum (código SQLSTATE) em vez de lançar. */
export async function exec(sql: string, params: unknown[] = []): Promise<DbError> {
  try {
    await rows(sql, params);
    return null;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { code: e.code, message: e.message };
  }
}

/** Escolhe a implementação a cada chamada: Postgres do Doca (DATA_BACKEND=postgres) ou Supabase. */
export function pick<T extends object>(supabase: T, postgres: { [K in keyof T]: T[K] }): T {
  type Fn = (...a: unknown[]) => unknown;
  const out = {} as Record<keyof T, Fn>;
  for (const k of Object.keys(supabase) as (keyof T)[]) {
    if (typeof supabase[k] !== "function") continue;
    out[k] = (...args) => ((isPostgres() ? postgres[k] : supabase[k]) as Fn)(...args);
  }
  return out as T;
}
