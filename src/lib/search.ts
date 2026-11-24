// Lógica pura da busca de aulas (sem imports do Next): roda no servidor e nos testes (node --test).
// Duas pontas usam o mesmo vocabulário: a RPC search_lessons (migração 0009) e a busca em memória (sem a migração).

export const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Palavras de ligação que não ajudam a achar aula ("como criar usuários" = criar + usuários). */
const STOP = new Set(
  ("a o as os um uma uns umas de do da dos das em no na nos nas por para pra com sem sobre ao aos e ou que se " +
   "como qual quais quando onde quero queria preciso gostaria saber fazer faco faz posso pode podem " +
   "ver ter tem meu minha meus minhas seu sua eu voce vc mais muito ja so nao sim isso isto esse essa este esta aqui la " +
   "ser sao foi vai vou e eh to ta").split(/\s+/),
);

/** Conceitos do domínio: quem procura uma palavra do grupo também aceita as outras. Tudo sem acento. */
const SINONIMOS: string[][] = [
  ["criar", "cadastrar", "adicionar", "incluir", "inserir", "novo", "nova"],
  ["usuario", "agente", "atendente", "operador"],
  ["editar", "alterar", "modificar", "atualizar"],
  ["excluir", "apagar", "remover", "deletar"],
  ["conectar", "vincular", "integrar", "ligar"],
  ["relatorio", "metrica", "indicador"],
  ["etiqueta", "tag"],
  ["oportunidade", "negocio", "lead"],
  ["horario", "expediente"],
];

/** Radical grosseiro (plural, infinitivo, gerúndio, particípio) para casar "usuários" com "usuário" e "criando" com "criar". */
export function stem(word: string): string {
  let w = normalize(word);
  const cut = (suf: string[]) => { for (const s of suf) if (w.length - s.length >= 3 && w.endsWith(s)) { w = w.slice(0, -s.length); return; } };
  cut(["coes", "oes", "s"]);
  cut(["ando", "endo", "indo", "ado", "ido", "ar", "er", "ir", "r"]);
  cut(["a", "o", "e"]);
  return w;
}

/** Palavras da busca sem acento e sem palavras vazias. Se só sobrar ligação ("como"), usa o que o aluno digitou. */
export function queryWords(q: string): string[] {
  const all = normalize(q.slice(0, 120)).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const keep = all.filter((w) => !STOP.has(w));
  return [...new Set(keep.length ? keep : all)].slice(0, 8);
}

/** Cada palavra vira um conceito: [ela mesma, sinônimos]. A última palavra aceita prefixo ("usu" acha "usuário"). Formato da RPC. */
export function queryGroups(words: string[]): string[][] {
  return words.map((w, i) => {
    const syn = SINONIMOS.find((g) => g.some((s) => stem(s) === stem(w)));
    const base = [i === words.length - 1 && w.length >= 3 ? `${w}*` : w];
    return syn ? [...base, ...syn.filter((s) => stem(s) !== stem(w))] : base;
  });
}

export type MatchWhere = "title" | "summary" | "text" | "transcript";

/** Rótulo discreto de onde a aula casou. */
export const WHERE_LABEL: Record<MatchWhere, string> = {
  title: "No título",
  summary: "No resumo da aula",
  text: "No texto da aula",
  transcript: "Mencionado no vídeo",
};

export type SearchDoc = { id: string; title: string; moduleTitle: string; summary: string | null; steps: string[]; text?: string };
export type Hit = { id: string; matched: MatchWhere };

const hasStem = (hay: string, stems: string[]) => stems.some((s) => hay.includes(s));

/**
 * Busca em memória (usada quando a migração 0009 ainda não foi aplicada). Cada conceito (palavra ou sinônimo)
 * conta uma vez; título pesa mais. Ordena por acertos, depois por título. Não olha a transcrição.
 */
export function searchInMemory(docs: SearchDoc[], q: string): Hit[] {
  const groups = queryGroups(queryWords(q));
  if (!groups.length) return [];
  const gs = groups.map((g) => g.map((w) => stem(w.replace(/\*$/, ""))));
  const scored: { d: SearchDoc; score: number; hits: number; matched: MatchWhere }[] = [];
  for (const d of docs) {
    const title = normalize(d.title);
    const mid = normalize(`${d.moduleTitle} ${d.summary ?? ""} ${d.steps.join(" ")}`);
    const body = normalize(d.text ?? "");
    let score = 0, hits = 0;
    let where: MatchWhere = "text";
    let inTitle = false, inMid = false;
    for (const g of gs) {
      const t = hasStem(title, g), m = hasStem(mid, g), b = hasStem(body, g);
      if (t || m || b) hits++;
      score += (t ? 5 : 0) + (m ? 2 : 0) + (b ? 1 : 0);
      inTitle ||= t; inMid ||= m;
    }
    if (!hits) continue;
    where = inTitle ? "title" : inMid ? "summary" : "text";
    scored.push({ d, score, hits, matched: where });
  }
  return scored
    .sort((a, b) => b.hits - a.hits || b.score - a.score || a.d.title.localeCompare(b.d.title, "pt-BR"))
    .map((s) => ({ id: s.d.id, matched: s.matched }));
}

/** Texto corrido do markdown da aula (sem marcações) para trechos. */
function plain(md: string): string {
  return md
    .replace(/^\s*>\s*\[![^\]]*\]\s*/gm, "")
    .replace(/[#>*`_]/g, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type SnippetPart = { text: string; hit: boolean };

/** Trecho curto do TEXTO PUBLICADO da aula com os termos em destaque. Null se nenhum termo aparece. */
export function snippet(body: string, words: string[], radius = 80): SnippetPart[] | null {
  const src = plain(body);
  // Mesma largura que o original (NFD e primeira letra), para os índices valerem nos dois textos.
  const norm = Array.from(src, (c) => c.normalize("NFD")[0].toLowerCase()).join("");
  if (norm.length !== src.length) return null;
  const stems = [...new Set(words.flatMap((w) => queryGroups([w])[0]).map((w) => stem(w.replace(/\*$/, ""))))].filter((s) => s.length >= 3);
  if (!stems.length) return null;
  const re = new RegExp(`(?<![a-z0-9])(?:${stems.map((s) => s.replace(/[^a-z0-9]/g, "")).filter(Boolean).join("|")})[a-z0-9]*`, "g");
  const first = re.exec(norm);
  if (!first) return null;
  let a = Math.max(0, first.index - radius), b = Math.min(src.length, first.index + radius * 1.5);
  if (a > 0) { const sp = src.indexOf(" ", a); if (sp > -1 && sp < first.index) a = sp + 1; }
  if (b < src.length) { const sp = src.lastIndexOf(" ", b); if (sp > first.index) b = sp; }
  const parts: SnippetPart[] = [];
  let pos = a;
  re.lastIndex = a;
  for (let m = re.exec(norm); m && m.index < b; m = re.exec(norm)) {
    if (m.index > pos) parts.push({ text: src.slice(pos, m.index), hit: false });
    const end = Math.min(m.index + m[0].length, b);
    parts.push({ text: src.slice(m.index, end), hit: true });
    pos = end;
  }
  if (pos < b) parts.push({ text: src.slice(pos, b), hit: false });
  if (a > 0) parts[0] = { ...parts[0], text: `…${parts[0].text}` };
  if (b < src.length) parts[parts.length - 1] = { ...parts[parts.length - 1], text: `${parts[parts.length - 1].text}…` };
  return parts;
}
