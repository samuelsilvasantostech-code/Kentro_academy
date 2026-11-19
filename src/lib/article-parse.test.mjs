// Rodar: node --test src/lib/article-parse.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseArticle, parseInline } from "./article-parse.ts";

test("seções viram índice com ids únicos e sem acento", () => {
  const a = parseArticle("## Configuração\n\ntexto\n\n## Configuração\n\n### Sub");
  assert.deepEqual(a.toc, [{ id: "s-configuracao", title: "Configuração" }, { id: "s-configuracao-2", title: "Configuração" }]);
  assert.equal(a.blocks[3].k, "h3");
});

test("parágrafo junta linhas; listas separam ul e ol", () => {
  const a = parseArticle("linha um\nlinha dois\n\n- a\n- b\n1. x\n2. y");
  assert.deepEqual(a.blocks[0], { k: "p", text: "linha um linha dois" });
  assert.deepEqual(a.blocks[1], { k: "ul", items: ["a", "b"] });
  assert.deepEqual(a.blocks[2], { k: "ol", items: ["x", "y"] });
});

test("destaques: tipo, título e linhas", () => {
  const a = parseArticle("> [!atenção] Cuidado\n> Não apague a fila.\n> Faça backup.");
  assert.deepEqual(a.blocks[0], { k: "callout", kind: "atencao", title: "Cuidado", lines: ["Não apague a fila.", "Faça backup."] });
  assert.equal(parseArticle("> só uma citação").blocks[0].kind, null);
});

test("inline: negrito, itálico, tecla e link https", () => {
  assert.deepEqual(parseInline("abra **Config** e `Filas` *já* [docs](https://kentro.com.br/a)"), [
    { t: "text", v: "abra " }, { t: "b", v: [{ t: "text", v: "Config" }] }, { t: "text", v: " e " },
    { t: "kbd", v: "Filas" }, { t: "text", v: " " }, { t: "i", v: "já" }, { t: "text", v: " " },
    { t: "a", v: "docs", href: "https://kentro.com.br/a" },
  ]);
});

test("links que não são https e HTML ficam como texto", () => {
  for (const s of ["[x](javascript:alert(1))", "[x](http://a.com)", "<img src=x onerror=alert(1)>"]) {
    assert.ok(parseInline(s).every((n) => n.t === "text"), s);
  }
});
