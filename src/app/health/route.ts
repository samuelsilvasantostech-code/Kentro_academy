// Verificação de saúde do Doca: responde sem tocar no banco nem na sessão.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
