// Roda uma vez quando o servidor sobe. No Doca (com DATABASE_URL), aplica as migrações de db/migrations.
// Falha aqui não impede o site de subir: o erro vai para o log e o /health mostra o banco com problema.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Na Vercel o app não usa este banco: migrações são só do Doca.
  if (process.env.VERCEL) return;
  const { getPool } = await import("./lib/db/pg/pool");
  const pool = getPool();
  if (!pool) return;
  const { runMigrations } = await import("./lib/db/pg/migrate");
  const client = await pool.connect().catch((err: Error) => {
    console.error("[db] sem conexão com o banco, migrações não aplicadas:", err.message);
    return null;
  });
  if (!client) return;
  try {
    const applied = await runMigrations({ exec: (sql) => client.query(sql), query: (sql, params) => client.query(sql, params) });
    if (!applied.length) console.log("[db] banco em dia");
  } catch (err) {
    console.error("[db]", (err as Error).message);
  } finally {
    client.release();
  }
}
