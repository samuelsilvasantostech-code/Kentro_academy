/**
 * Texto da aula em um markdown pequeno, sem HTML (nada vira código na página):
 *   ## Título de seção        ### Subtítulo
 *   - item / 1. item          **negrito**  *itálico*  `tecla ou menu`  [link](https://...)
 *   > [!dica] Título opcional     (também [!atencao] e [!importante]; linhas seguintes com "> ")
 *   ---                        (divisória)
 * Parágrafos são separados por linha em branco.
 */
export type Callout = "dica" | "atencao" | "importante";
type Block =
  | { k: "h2" | "h3"; text: string; id: string }
  | { k: "p"; text: string }
  | { k: "ul" | "ol"; items: string[] }
  | { k: "callout"; kind: Callout | null; title: string; lines: string[] }
  | { k: "hr" };

export type Article = { blocks: Block[]; toc: { id: string; title: string }[]; words: number };

const slug = (s: string) =>
  "s-" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function parseArticle(md: string): Article {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const seen = new Map<string, number>();
  let para: string[] = [];
  const flush = () => { if (para.length) blocks.push({ k: "p", text: para.join(" ") }); para = []; };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    if (h) {
      flush();
      let id = slug(h[2]);
      const n = seen.get(id) ?? 0;
      seen.set(id, n + 1);
      if (n) id += `-${n + 1}`;
      blocks.push({ k: h[1].length === 2 ? "h2" : "h3", text: h[2], id });
      continue;
    }
    if (/^-{3,}$/.test(line)) { flush(); blocks.push({ k: "hr" }); continue; }
    const li = /^([-*]|\d+[.)])\s+(.+)$/.exec(line);
    if (li) {
      flush();
      const k = /\d/.test(li[1]) ? "ol" : "ul";
      const items = [li[2]];
      while (i + 1 < lines.length) {
        const m = /^\s*([-*]|\d+[.)])\s+(.+)$/.exec(lines[i + 1]);
        if (!m || /\d/.test(m[1]) !== (k === "ol")) break;
        items.push(m[2].trim());
        i++;
      }
      blocks.push({ k, items });
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      const first = line.replace(/^>\s?/, "");
      const tag = /^\[!(dica|atencao|atenção|importante)\]\s*(.*)$/i.exec(first);
      const kind = tag ? (tag[1].toLowerCase().replace("ç", "c").replace("ã", "a") as Callout) : null;
      const body: string[] = tag ? [] : [first];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith(">")) body.push(lines[++i].trim().replace(/^>\s?/, ""));
      blocks.push({ k: "callout", kind, title: tag?.[2] ?? "", lines: body.filter(Boolean) });
      continue;
    }
    para.push(line);
  }
  flush();
  const toc = blocks.flatMap((b) => (b.k === "h2" ? [{ id: b.id, title: b.text.replace(/[*`]/g, "") }] : []));
  const words = md.split(/\s+/).filter(Boolean).length;
  return { blocks, toc, words };
}

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; v: Inline[] }
  | { t: "i" | "kbd"; v: string }
  | { t: "a"; v: string; href: string };

// Só links https; qualquer outra coisa (javascript:, http:, HTML) fica como texto puro.
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[1]) out.push({ t: "b", v: parseInline(m[1]) });
    else if (m[2]) out.push({ t: "i", v: m[2] });
    else if (m[3]) out.push({ t: "kbd", v: m[3] });
    else out.push({ t: "a", v: m[4], href: m[5] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}
