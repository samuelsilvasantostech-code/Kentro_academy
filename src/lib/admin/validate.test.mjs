// Rodar: node --test src/lib/admin/validate.test.mjs  (Node 22.18+/24: strip de tipos nativo; sem dependência nova)
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeId, parseDuration, formatDuration, parseChapters, parseMaterials, parseLines, parseSlug,
  parseHexColor, parseHttpUrl, text, moveId, parseQuizOptions, parseCorrectIndex, parseUuid,
} from "./validate.ts";

const ID = "dQw4w9WgXcQ";
const yt = (s) => parseYouTubeId(s);

test("parseYouTubeId: formatos aceitos", () => {
  for (const s of [
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=10s&list=PL1`,
    `youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `https://www.youtube.com/live/${ID}`,
    `  https://youtu.be/${ID}  `,
    `HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`,
  ]) assert.deepEqual(yt(s), { ok: true, value: ID }, s);
});

test("parseYouTubeId: rejeita o resto", () => {
  for (const s of [
    "",
    "   ",
    `https://vimeo.com/${ID}`,
    `https://youtube.com.evil.io/watch?v=${ID}`,
    `https://evilyoutube.com/watch?v=${ID}`,
    `https://notyoutu.be/${ID}`,
    `https://youtube.com@evil.io/watch?v=${ID}`,
    `https://evil.io/youtube.com/watch?v=${ID}`,
    `https://evil.io/?u=youtube.com&v=${ID}`,
    `javascript:alert(1)//youtube.com/watch?v=${ID}`,
    `ftp://youtube.com/watch?v=${ID}`,
    `data:text/html,youtube.com/watch?v=${ID}`,
    "dQw4w9WgXc", // 10
    "dQw4w9WgXcQQ", // 12
    "dQw4w9WgXc!", // 11 com caractere inválido
    "https://www.youtube.com/watch?v=curto",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/",
    `https://www.youtube.com/channel/${ID}`,
    "<script>",
  ]) assert.equal(yt(s).ok, false, s);
});

test("parseDuration", () => {
  assert.deepEqual(parseDuration("4:32"), { ok: true, value: 272 });
  assert.deepEqual(parseDuration("04:32"), { ok: true, value: 272 });
  assert.deepEqual(parseDuration("75:00"), { ok: true, value: 4500 });
  assert.deepEqual(parseDuration("1:02:03"), { ok: true, value: 3723 });
  for (const s of ["", "432", "4:60", "4:3", "0:00", "a:bc", "1:2:3", "1:60:00", "-1:30", "4:32:", "1:2:3:4", "25:00:00"])
    assert.equal(parseDuration(s).ok, false, s);
  assert.equal(formatDuration(272), "4:32");
  assert.equal(formatDuration(3723), "1:02:03");
});

test("parseChapters e parseMaterials", () => {
  assert.deepEqual(parseChapters("1:30 Segundo\n0:00 Início\n\n"), {
    ok: true,
    value: [{ start_seconds: 0, title: "Início" }, { start_seconds: 90, title: "Segundo" }],
  });
  assert.equal(parseChapters("Sem tempo").ok, false);
  assert.equal(parseChapters("1:75 Ruim").ok, false);
  assert.equal(parseChapters("").ok, true);
  assert.deepEqual(parseMaterials("Guia | https://x.com/a.pdf | Passo a passo\nOutro | http://y.com"), {
    ok: true,
    value: [
      { title: "Guia", url: "https://x.com/a.pdf", description: "Passo a passo" },
      { title: "Outro", url: "http://y.com", description: null },
    ],
  });
  assert.equal(parseMaterials("Guia | javascript:alert(1)").ok, false);
  assert.equal(parseMaterials("Guia | /relativo").ok, false);
  assert.equal(parseMaterials("so titulo").ok, false);
});

test("slug, cor, url, texto, uuid, quiz, moveId", () => {
  assert.equal(parseSlug("Gestao-Da-Operacao").ok, true);
  for (const s of ["", "a", "-a", "a--b", "a b", "ação"]) assert.equal(parseSlug(s).ok, false, s);
  assert.deepEqual(parseHexColor("#8b5cf6"), { ok: true, value: "#8B5CF6" });
  assert.equal(parseHexColor("#fff").ok, false);
  assert.equal(parseHttpUrl("/trilha/x", { allowRelative: true }).ok, true);
  assert.equal(parseHttpUrl("//evil.io", { allowRelative: true }).ok, false);
  assert.equal(parseHttpUrl("/trilha/x").ok, false);
  assert.equal(parseHttpUrl("https://a.com/x y").ok, false);
  assert.equal(parseHttpUrl("javascript:alert(1)").ok, false);
  assert.equal(parseHttpUrl("https://user:pass@a.com/x").ok, false);
  assert.equal(parseHttpUrl("https://user@a.com").ok, false);
  assert.equal(parseHttpUrl("https://a.com/x").ok, true);
  assert.equal(text("  oi  ", { min: 1, max: 5 }).ok, true);
  assert.equal(text("", { min: 1, max: 5 }).ok, false);
  assert.equal(text("abcdef", { max: 5 }).ok, false);
  assert.equal(text(null, { max: 5 }).ok, true);
  assert.equal(parseLines("a\n\n b \n", { max: 5, maxLen: 5 }).value.length, 2);
  assert.equal(parseUuid("not-a-uuid").ok, false);
  assert.equal(parseUuid("123e4567-e89b-12d3-a456-426614174000").ok, true);
  assert.equal(parseQuizOptions("a").ok, false);
  assert.equal(parseQuizOptions("a\nb\nc\nd\ne\nf\ng").ok, false);
  assert.equal(parseQuizOptions("a\nb").ok, true);
  assert.equal(parseCorrectIndex("1", 2).ok, true);
  assert.equal(parseCorrectIndex("2", 2).ok, false);
  assert.equal(parseCorrectIndex("", 2).ok, false);
  assert.deepEqual(moveId(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.equal(moveId(["a", "b"], "a", "up"), null);
  assert.equal(moveId(["a", "b"], "z", "down"), null);
});
