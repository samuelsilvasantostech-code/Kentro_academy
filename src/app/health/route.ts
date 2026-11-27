import { dbStatus } from "@/lib/db/pg/pool";

// Verificação de saúde do Doca. Não toca na sessão.
// db: "ok" | "nao_configurado" | "erro". Só derruba o /health (503) quando o app já usa o Postgres
// (DATA_BACKEND=postgres); antes disso, banco fora do ar não tira o site do ar.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await dbStatus();
  const ok = !(process.env.DATA_BACKEND === "postgres" && db !== "ok");
  return Response.json({ ok, db }, { status: ok ? 200 : 503 });
}
