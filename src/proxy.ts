import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão do Supabase a cada pedido e manda quem não entrou para /entrar.
// É só a checagem otimista: cada página e ação confere o usuário de novo no servidor.
const PUBLIC = ["/entrar", "/auth/", "/health"];

export async function proxy(request: NextRequest) {
  const isPublic = PUBLIC.some((p) => request.nextUrl.pathname.startsWith(p));
  // Página pública sem cookie de sessão: não há o que renovar nem conferir.
  if (isPublic && !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, httpOnly: true }));
        },
      },
    },
  );

  // getClaims confere a assinatura do token localmente (chave ES256 do projeto; o JWKS fica em cache)
  // e renova a sessão quando o token venceu. Sem ida ao servidor de Auth a cada navegação.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
