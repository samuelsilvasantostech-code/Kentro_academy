import { NextResponse, type NextRequest } from "next/server";
import { confirmEmailLink } from "@/lib/db/auth";

/** Só caminhos do próprio site: começa com "/", não com "//", sem "\" nem caracteres de controle. */
function safeNext(raw: string | null, origin: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) return null;
  try {
    const u = new URL(raw, origin);
    return u.origin === origin ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}

// Link do e-mail (confirmação de cadastro e redefinição de senha): troca o código ou o token por sessão.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"), origin);

  const ok = await confirmEmailLink({ tokenHash: searchParams.get("token_hash"), type, code: searchParams.get("code") });

  if (!ok) return NextResponse.redirect(new URL("/entrar?erro=link", origin));
  // Recuperação de senha sempre cai na tela de nova senha, mesmo sem o parâmetro next.
  return NextResponse.redirect(new URL(type === "recovery" ? "/redefinir-senha" : (next ?? "/comecar"), origin));
}
