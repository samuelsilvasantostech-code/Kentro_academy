// Copia todos os dados do Supabase para o Postgres do Doca e confere tabela por tabela.
// (No Doca o banco não aceita conexão de fora: lá a cópia é feita pela tela /admin/migracao, com a mesma lógica.)
//
// Uso (na pasta app):
//   node --env-file=.env.migracao scripts/migrar-dados.mjs              copia e confere
//   node --env-file=.env.migracao scripts/migrar-dados.mjs --conferir   só confere
//
// .env.migracao (NUNCA vai para o git; .env* já está no .gitignore):
//   SUPABASE_DB_URL=postgresql://...supabase.com:5432/postgres     (origem: Supabase › Settings › Database)
//   DATABASE_URL=postgresql://...                                    (destino: banco do Doca)
//   TRANSCRICOES_DIR=../transcricoes                                 (opcional; usado se o Supabase ainda não tiver a 0009)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { runMigrations } from "../src/lib/db/pg/migrate.ts";
import { checkAll, copyAll, poolConfig } from "../src/lib/db/pg/copiar.ts";

const ONLY_CHECK = process.argv.includes("--conferir");

function pool(url, name) {
  if (!url) throw new Error(`${name} não definido (veja o topo do script)`);
  return new pg.Pool(poolConfig(url));
}

async function transcriptsFromFolder() {
  const dir = path.resolve(process.env.TRANSCRICOES_DIR || "../transcricoes");
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".txt"));
  const rows = [];
  for (const f of files) rows.push({ lesson_id: f.slice(0, -4), body: (await readFile(path.join(dir, f), "utf8")).slice(0, 200_000) });
  console.log(`  transcrições: ${rows.length} arquivos de ${dir}`);
  return rows;
}

async function main() {
  const src = pool(process.env.SUPABASE_DB_URL, "SUPABASE_DB_URL");
  const dst = pool(process.env.DATABASE_URL, "DATABASE_URL");
  try {
    const c = await dst.connect();
    try {
      await runMigrations({ exec: (sql) => c.query(sql), query: (sql, p) => c.query(sql, p) });
    } finally {
      c.release();
    }
    if (!ONLY_CHECK) {
      console.log("Copiando do Supabase para o Doca…");
      for (const l of await copyAll(src, dst, transcriptsFromFolder)) console.log(`  ${l.tabela}: ${l.linhas}`);
    }
    const report = await checkAll(src, dst);
    console.table(report.map((r) => ({ ...r, confere: r.confere ? "sim" : "NÃO" })));
    const ok = report.every((r) => r.confere);
    console.log(ok ? "\nTudo confere." : "\nATENÇÃO: há tabelas que não conferem (veja acima).");
    process.exitCode = ok ? 0 : 1;
  } finally {
    await Promise.all([src.end(), dst.end()]);
  }
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exitCode = 1;
});
