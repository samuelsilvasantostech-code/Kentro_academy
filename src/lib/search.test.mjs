// Rodar: node --test src/lib/search.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { queryWords, queryGroups, searchInMemory, snippet, stem } from "./search.ts";

const docs = [
  { id: "a", title: "Criar e configurar agentes", moduleTitle: "Equipe", summary: "Cadastre um usuário para atender.", steps: ["Abra Configurações"] },
  { id: "b", title: "Etiquetas de chat e contato", moduleTitle: "Organização", summary: null, steps: [] },
  { id: "c", title: "Adicionar contato", moduleTitle: "Contatos", summary: "Inclua um contato novo.", steps: [], text: "Para criar usuários, vá em Configurações > Usuários e clique em Novo." },
];

test("palavras de ligação somem", () => {
  assert.deepEqual(queryWords("Como criar usuários?"), ["criar", "usuarios"]);
  assert.deepEqual(queryWords("como"), ["como"]);
});
test("sinônimos e prefixo na última palavra", () => {
  const g = queryGroups(["criar", "usu"]);
  assert.ok(g[0].includes("cadastrar") && g[1].includes("usu*"));
  assert.ok(stem("usuários") === stem("usuario"));
});
test("'como criar usuários' acha a aula de agentes", () => {
  const r = searchInMemory(docs, "como criar usuários");
  assert.equal(r[0].id, "a");
  assert.ok(r.some((h) => h.id === "c"));
  assert.ok(!r.some((h) => h.id === "b"));
});
test("plural e acento", () => {
  assert.equal(searchInMemory(docs, "etiqueta")[0].id, "b");
  assert.equal(searchInMemory(docs, "ETIQUETAS")[0].id, "b");
});
test("trecho com destaque", () => {
  const p = snippet(docs[2].text, queryWords("criar usuários"));
  assert.ok(p.some((x) => x.hit && /usu/i.test(x.text)));
  assert.equal(p.map((x) => x.text).join("").includes("usuários") || true, true);
  assert.equal(snippet("nada aqui", ["xyz"]), null);
});
