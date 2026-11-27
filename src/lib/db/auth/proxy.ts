// Entrada própria para o proxy (src/proxy.ts): não puxa o resto do módulo de auth.
import { NextResponse, type NextRequest } from "next/server";
import { isPostgres } from "../backend";
import { refreshSession as refreshSupabase } from "../supabase/proxy";

const SESSION_COOKIE = "kentro_sessao"; // igual a pg/auth.ts (sem importar o pg aqui)

/** Checagem otimista: no login próprio basta haver o cookie; cada página e ação confere a sessão no banco. */
export async function refreshSession(request: NextRequest, isPublic: boolean): Promise<NextResponse> {
  if (!isPostgres()) return refreshSupabase(request, isPublic);
  if (isPublic || request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next({ request });
  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}
