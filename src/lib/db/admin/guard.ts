import { isPostgres } from "../backend";
import type { AdminSession } from "./session";

/**
 * Transforma uma função da camada de dados em uma que exige a prova de admin como primeiro parâmetro.
 * A prova só existe depois de requireAdmin()/getAdmin(), então código sem ela nem compila.
 */
export const withAdmin =
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  (_admin: AdminSession, ...args: A): R =>
    fn(...args);

/**
 * Como withAdmin, escolhendo a implementação a cada chamada (DATA_BACKEND): a do Postgres recebe o id do admin
 * primeiro (as funções do banco conferem is_admin de novo); a do Supabase usa a sessão (RLS).
 */
export const adminFn =
  <A extends unknown[], R>(supabase: (...args: A) => R, postgres: (adminId: string, ...args: A) => R) =>
  (admin: AdminSession, ...args: A): R =>
    isPostgres() ? postgres(admin.user.id, ...args) : supabase(...args);
