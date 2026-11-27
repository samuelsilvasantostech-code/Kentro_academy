import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isPostgres } from "../backend";
import { resolveAdmin as resolveSupabase } from "../supabase/admin/session";
import { resolveAdmin as resolvePostgres } from "../pg/auth";

const resolveAdmin = () => (isPostgres() ? resolvePostgres() : resolveSupabase());
import type { SessionUser } from "../auth/types";

declare const adminBrand: unique symbol;

/**
 * Prova de que a sessão atual é de um admin. Só `requireAdmin`, `getAdmin` e `getAdminOrNotFound` (este
 * arquivo) criam um valor deste tipo, depois de conferir no banco. Toda função de `@/lib/db/admin` recebe
 * a prova como primeiro parâmetro, então o TypeScript impede o código do aluno de chamá-las.
 */
export type AdminSession = { readonly user: SessionUser; readonly [adminBrand]: true };

const mint = (user: SessionUser): AdminSession => ({ user }) as AdminSession;

/** Para layout e pages (com cache por pedido). Devolve null se não houver sessão ou se não for admin. */
export const getAdmin = cache(async (): Promise<AdminSession | null> => {
  const r = await resolveAdmin();
  return r.user && r.admin ? mint(r.user) : null;
});

/** Para pages do /admin: quem não é admin recebe 404 (o /admin não revela que existe). */
export async function getAdminOrNotFound(): Promise<AdminSession> {
  const a = await getAdmin();
  if (!a) notFound();
  return a;
}

/**
 * Para server actions: SEM cache, para conferir a cada chamada.
 * Sem sessão vai para /entrar; quem não é admin recebe 404 (o /admin não revela que existe).
 */
export async function requireAdmin(): Promise<AdminSession> {
  const r = await resolveAdmin();
  if (!r.user) redirect("/entrar");
  if (!r.admin) notFound();
  return mint(r.user);
}
