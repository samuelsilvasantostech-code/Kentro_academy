// Erros do Supabase viram mensagem genérica; o detalhe vai só para o log do servidor (sem dados do formulário).
type DbError = { code?: string; message?: string } | null | undefined;

export function logDbError(action: string, error: DbError) {
  console.error(JSON.stringify({ level: "error", scope: "admin", action, code: error?.code ?? null, message: error?.message ?? null }));
}

/** Violação de unicidade (slug, vídeo repetido). */
export const isUnique = (e: DbError) => e?.code === "23505";
/** Sem permissão (RLS ou is_admin() dentro de uma RPC). */
export const isForbidden = (e: DbError) => e?.code === "42501";
