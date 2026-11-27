/**
 * Qual banco o app usa. DATA_BACKEND=postgres só no Doca; sem ela (Vercel), tudo segue no Supabase.
 * Lido a cada chamada (variável de servidor, não entra no build).
 */
export const isPostgres = () => process.env.DATA_BACKEND === "postgres";
