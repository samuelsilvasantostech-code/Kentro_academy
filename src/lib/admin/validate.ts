// Validação pura do /admin: sem imports do Next, roda no cliente (prévia) e no servidor (fonte da verdade).
// Toda função devolve Result<T>; mensagens curtas em pt-BR.

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = (error: string): Result<never> => ({ ok: false, error });

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Texto de uma linha ou várias: tira espaços, normaliza quebras de linha e remove NUL (o Postgres rejeita). */
export function text(v: unknown, o: { min?: number; max: number }): Result<string> {
  const s = str(v).replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
  const min = o.min ?? 0;
  if (s.length === 0 && min > 0) return err("Preencha este campo");
  if (s.length < min) return err(`Use pelo menos ${min} caracteres`);
  if (s.length > o.max) return err(`Use no máximo ${o.max} caracteres`);
  return ok(s);
}

// ---------- YouTube ----------

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "youtube-nocookie.com", "youtu.be"]);

/** Aceita ID puro ou link do YouTube (watch, youtu.be, shorts, embed, live). Host por igualdade exata. */
export function parseYouTubeId(input: unknown): Result<string> {
  const raw = str(input).trim();
  const bad = err("Cole um link do YouTube ou o ID de 11 caracteres");
  if (!raw) return err("Cole o link do vídeo");
  if (YT_ID.test(raw)) return ok(raw);

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    // Qualquer outro esquema (javascript:, data:, ftp:...) é rejeitado.
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return bad;
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return bad;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return bad;
  if (url.username || url.password) return bad;

  const host = url.hostname.toLowerCase().replace(/^(?:www|m)\./, "");
  if (!YT_HOSTS.has(host)) return bad;

  const seg = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = seg[0] ?? null;
  else if (seg[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "embed", "live"].includes(seg[0])) id = seg[1] ?? null;

  return id && YT_ID.test(id) ? ok(id) : bad;
}

// ---------- Tempo ----------

function timestamp(s: string, allowZero: boolean): Result<number> {
  const bad = err("Use o formato m:ss ou h:mm:ss (ex.: 4:32)");
  const parts = s.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d{1,3}$/.test(p))) return bad;
  const n = parts.map(Number);
  const sec = n[n.length - 1];
  const min = n[n.length - 2];
  if (parts[parts.length - 1].length !== 2 || sec > 59) return bad;
  if (parts.length === 3 && (parts[1].length !== 2 || min > 59 || n[0] > 23)) return bad;
  const total = parts.length === 3 ? n[0] * 3600 + min * 60 + sec : min * 60 + sec;
  if (!allowZero && total === 0) return err("A duração deve ser maior que zero");
  if (total > 24 * 3600) return err("A duração passa de 24 horas");
  return ok(total);
}

/** "m:ss", "mm:ss" ou "h:mm:ss" para segundos. */
export const parseDuration = (v: unknown): Result<number> => timestamp(str(v), false);

/** Segundos para "m:ss" ou "h:mm:ss" (para preencher o formulário de edição). */
export function formatDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// ---------- Linhas, URLs, slug, cor ----------

/** Uma entrada por linha; linhas vazias são ignoradas. */
export function parseLines(v: unknown, o: { max: number; maxLen: number }): Result<string[]> {
  const lines = str(v).replace(/\u0000/g, "").split(/\r\n?|\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > o.max) return err(`Use no máximo ${o.max} linhas`);
  if (lines.some((l) => l.length > o.maxLen)) return err(`Cada linha aceita até ${o.maxLen} caracteres`);
  return ok(lines);
}

export function parseSlug(v: unknown): Result<string> {
  const s = str(v).trim().toLowerCase();
  if (s.length < 2 || s.length > 60 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
    return err("Use letras minúsculas, números e hífens (ex.: gestao-da-operacao)");
  return ok(s);
}

export function parseHexColor(v: unknown): Result<string> {
  const s = str(v).trim();
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? ok(s.toUpperCase()) : err("Use uma cor no formato #RRGGBB");
}

/** URL http(s). Com allowRelative aceita também caminhos internos ("/trilha/x"), nunca "//host" nem "\". */
export function parseHttpUrl(v: unknown, o: { allowRelative?: boolean } = {}): Result<string> {
  const s = str(v).trim();
  const bad = err(o.allowRelative ? "Use um link http(s) ou um caminho que começa com /" : "Use um link que começa com http:// ou https://");
  if (!s || s.length > 2000 || /[\s\u0000-\u001f\u007f\\]/.test(s)) return bad;
  if (o.allowRelative && s.startsWith("/") && !s.startsWith("//")) return ok(s);
  try {
    const u = new URL(s);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname || u.username || u.password) return bad;
  } catch {
    return bad;
  }
  return ok(s);
}

/** UUID (ids de módulo, pergunta, novidade). */
export function parseUuid(v: unknown): Result<string> {
  const s = str(v).trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? ok(s) : err("Identificador inválido");
}

/** Id de aula (slug do YouTube, "faq-webchat" ou uuid sem hífens). */
export function parseLessonId(v: unknown): Result<string> {
  const s = str(v).trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? ok(s) : err("Identificador inválido");
}

/** Checkbox HTML: "on"/"true" marcado; ausente desmarcado. */
export const parseCheckbox = (v: unknown): boolean => v === "on" || v === "true";

export function parseDirection(v: unknown): Result<"up" | "down"> {
  return v === "up" || v === "down" ? ok(v) : err("Direção inválida");
}

/** Troca o item de lugar com o vizinho. null se não der (já está na ponta ou não existe). */
export function moveId<T>(ids: T[], id: T, dir: "up" | "down"): T[] | null {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ---------- Capítulos e materiais (textareas) ----------

export type Chapter = { start_seconds: number; title: string };
export type Material = { title: string; url: string; description: string | null };

/** Uma linha por capítulo: "mm:ss Título". */
export function parseChapters(v: unknown): Result<Chapter[]> {
  const lines = parseLines(v, { max: 60, maxLen: 200 });
  if (!lines.ok) return lines;
  const out: Chapter[] = [];
  for (const [i, line] of lines.value.entries()) {
    const m = /^(\d{1,3}(?::\d{1,3}){1,2})\s+(.+)$/.exec(line);
    const t = m && timestamp(m[1], true);
    if (!m || !t || !t.ok) return err(`Capítulo da linha ${i + 1}: use "mm:ss Título"`);
    const title = text(m[2], { min: 1, max: 120 });
    if (!title.ok) return err(`Capítulo da linha ${i + 1}: título com até 120 caracteres`);
    out.push({ start_seconds: t.value, title: title.value });
  }
  return ok(out.sort((a, b) => a.start_seconds - b.start_seconds));
}

/** Uma linha por material: "Título | URL | descrição opcional". */
export function parseMaterials(v: unknown): Result<Material[]> {
  const lines = parseLines(v, { max: 30, maxLen: 2500 });
  if (!lines.ok) return lines;
  const out: Material[] = [];
  for (const [i, line] of lines.value.entries()) {
    const [title = "", url = "", ...rest] = line.split("|").map((p) => p.trim());
    const t = text(title, { min: 1, max: 120 });
    const u = parseHttpUrl(url);
    const d = text(rest.join(" | "), { max: 300 });
    if (!t.ok || !u.ok || !d.ok) return err(`Material da linha ${i + 1}: use "Título | https://link | descrição (opcional)"`);
    out.push({ title: t.value, url: u.value, description: d.value || null });
  }
  return ok(out);
}

/** Inverso dos parsers, para preencher o formulário de edição. */
export const chaptersToText = (c: Chapter[]) => c.map((x) => `${formatDuration(x.start_seconds)} ${x.title}`).join("\n");
export const materialsToText = (m: Material[]) =>
  m.map((x) => [x.title, x.url, x.description].filter((p) => p != null && p !== "").join(" | ")).join("\n");

// ---------- Quiz ----------

export type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string | null; lesson_id?: string | null };

/** Opções: uma por linha, de 2 a 6. */
export function parseQuizOptions(v: unknown): Result<string[]> {
  const lines = parseLines(v, { max: 6, maxLen: 300 });
  if (!lines.ok) return err("Use no máximo 6 alternativas, com até 300 caracteres cada");
  return lines.value.length < 2 ? err("Escreva de 2 a 6 alternativas, uma por linha") : ok(lines.value);
}

/** Índice (a partir de 0) da opção correta dentro das n opções. */
export function parseCorrectIndex(v: unknown, n: number): Result<number> {
  const s = str(v).trim();
  const i = /^\d{1,2}$/.test(s) ? Number(s) : -1;
  return i >= 0 && i < n ? ok(i) : err("Escolha a alternativa correta");
}
