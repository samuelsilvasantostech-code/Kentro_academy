import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/db/auth/proxy";

// Renova a sessão a cada pedido e manda quem não entrou para /entrar (a lógica fica em src/lib/db).
// É só a checagem otimista: cada página e ação confere o usuário de novo no servidor.
const PUBLIC = ["/entrar", "/auth/", "/health"];

export async function proxy(request: NextRequest) {
  const isPublic = PUBLIC.some((p) => request.nextUrl.pathname.startsWith(p));
  return refreshSession(request, isPublic);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
