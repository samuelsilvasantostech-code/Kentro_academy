import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function resolve() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  const { data, error } = await supabase.rpc("is_admin");
  return { supabase, user, admin: !error && data === true };
}

/** Para layout e pages (com cache por pedido). Devolve null se não houver sessão ou se não for admin. */
export const getAdmin = cache(async () => {
  const r = await resolve();
  return r.user && r.admin ? { supabase: r.supabase, user: r.user } : null;
});

/**
 * Para server actions: SEM cache, para conferir a cada chamada.
 * Sem sessão vai para /entrar; quem não é admin recebe 404 (o /admin não revela que existe).
 */
export async function requireAdmin() {
  const r = await resolve();
  if (!r.user) redirect("/entrar");
  if (!r.admin) notFound();
  return { supabase: r.supabase, user: r.user };
}
