// Rodar: node --test src/lib/db/boundary.test.mjs
// Garante a fronteira da camada de dados: nada de Supabase (nem consulta direta ao banco) fora de src/lib/db/,
// e o código do aluno nunca importa as funções do admin.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const norm = (p) => relative(SRC, p).split(sep).join("/");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({ path: norm(p), text: readFileSync(p, "utf8") }));
const outside = files.filter((f) => !f.path.startsWith("lib/db/") && !/\.test\.mjs$/.test(f.path));

// .from("tabela") / .rpc(...) do cliente de banco. Array.from(...) e afins não casam: exige literal de texto.
const FORBIDDEN = [
  [/supabase/i, "a palavra supabase"],
  [/createClient\b/, "createClient"],
  [/\.rpc\(/, ".rpc("],
  [/\.from\(\s*["'`]/, '.from("tabela")'],
];

test("nada de Supabase, .from(...) ou .rpc(...) fora de src/lib/db/", () => {
  const found = [];
  for (const f of outside) for (const [re, label] of FORBIDDEN) if (re.test(f.text)) found.push(`${f.path}: ${label}`);
  assert.deepEqual(found, [], `Mova para src/lib/db/:\n${found.join("\n")}`);
});

test("o código do aluno não importa a camada do admin", () => {
  const found = files
    .filter((f) => f.path.startsWith("app/(app)/") || f.path.startsWith("components/") || f.path.startsWith("lib/db/aluno/"))
    .filter((f) => /@\/lib\/db\/admin|\.\.\/admin/.test(f.text))
    .map((f) => f.path);
  assert.deepEqual(found, []);
});

test("toda função de lib/db/admin exige a prova de admin como primeiro parâmetro", () => {
  for (const name of ["queries", "writes"]) {
    const text = files.find((f) => f.path === `lib/db/admin/${name}.ts`).text;
    const exported = [...text.matchAll(/^export const (\w+) = (.*)$/gm)];
    assert.ok(exported.length > 5, `${name}: nenhuma exportação encontrada`);
    for (const [, fn, rhs] of exported) {
      assert.ok(/withAdmin\(|adminFn\(|\(admin: AdminSession/.test(rhs), `${name}.${fn} não passa por withAdmin`);
    }
  }
});

test("o aluno nunca lê o gabarito do quiz (correct/explanation)", () => {
  for (const f of files.filter((x) => x.path.startsWith("lib/db/supabase/aluno/"))) {
    const reads = [...f.text.matchAll(/from\("quiz_questions"\)\.select\(([^)]*)\)/g)];
    for (const [, args] of reads) assert.ok(!/\*|correct|explanation/.test(args), `${f.path}: select de quiz_questions com ${args}`);
  }
});

test("no Postgres, o caminho do aluno nunca lê correct/explanation do quiz", () => {
  const text = files.find((f) => f.path === "lib/db/pg/aluno.ts").text;
  const sqls = [...text.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
  const bad = sqls.filter((s) => /\b(correct|explanation)\b/.test(s));
  assert.deepEqual(bad, []);
  assert.ok(sqls.some((s) => s.includes("quiz_questions_aluno")), "perguntas do aluno vêm da view sem gabarito");
});
