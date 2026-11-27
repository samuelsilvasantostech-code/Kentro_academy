import type { AdminSession } from "./session";

/**
 * Transforma uma função da camada de dados em uma que exige a prova de admin como primeiro parâmetro.
 * A prova só existe depois de requireAdmin()/getAdmin(), então código sem ela nem compila.
 */
export const withAdmin =
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  (_admin: AdminSession, ...args: A): R =>
    fn(...args);
