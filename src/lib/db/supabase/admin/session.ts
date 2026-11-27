import { createClient } from "../client";
import { getSessionUser } from "../auth";
import type { SessionUser } from "../../auth/types";

/** Usuário da sessão e se ele é admin (RPC is_admin). Só confere; quem entrega a prova é db/admin/session. */
export async function resolveAdmin(): Promise<{ user: SessionUser | null; admin: boolean }> {
  const user = await getSessionUser();
  if (!user) return { user: null, admin: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  return { user, admin: !error && data === true };
}
