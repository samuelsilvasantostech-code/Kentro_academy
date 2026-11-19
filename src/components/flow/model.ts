import type { Lesson, Track } from "@/lib/catalog";

// Mesma regra de isRequired em lib/catalog (não importado porque catalog.ts é só de servidor e este módulo vai para o cliente).
const isRequired = (l: Lesson) => !!l.youtube_id;

export type NodeKind = "aula" | "quiz" | "certificado";
/** feito: concluído. proximo: para onde o aluno vai. pendente: ainda não chegou lá (ou é leitura opcional). */
export type NodeState = "feito" | "proximo" | "pendente";

export type FlowNode = {
  id: string;
  kind: NodeKind;
  state: NodeState;
  title: string;
  href: string;
  moduleIndex: number;
  /** Aula sem vídeo: não conta para o progresso nem bloqueia o próximo nó. */
  reading: boolean;
  /** Aula que o aluno está vendo agora (só quando buildFlow recebe `currentLessonId`). */
  current?: boolean;
};
export type FlowEdge = { from: number; to: number; /** o sinal já passou por aqui */ done: boolean };
export type Flow = {
  trackId: string;
  color: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Índice do nó que pulsa, ou -1 se a trilha está completa. */
  nextIndex: number;
};

/**
 * Trilha + progresso -> nós e conectores. Pura: só depende dos argumentos.
 * `quizModules`: ids dos módulos que têm quiz (com perguntas). Sem pergunta, sem nó.
 */
export function buildFlow(track: Track, done: Set<string>, quizPassed: Set<string>, quizModules: Set<string>, currentLessonId?: string): Flow {
  type Draft = Omit<FlowNode, "state"> & { ok: boolean; required: boolean };
  const drafts: Draft[] = [];
  track.modules.forEach((m, moduleIndex) => {
    m.lessons.forEach((l) => {
      const required = isRequired(l);
      drafts.push({
        id: `aula:${l.id}`,
        kind: "aula",
        title: l.title,
        href: `/aula/${track.id}/${l.id}`,
        moduleIndex,
        reading: !required,
        ok: done.has(l.id),
        required,
      });
    });
    if (quizModules.has(m.id)) {
      drafts.push({
        id: `quiz:${m.id}`,
        kind: "quiz",
        title: `Quiz: ${m.title}`,
        href: `/quiz/${track.id}/${moduleIndex}`,
        moduleIndex,
        reading: false,
        ok: quizPassed.has(m.id),
        required: true,
      });
    }
  });
  if (drafts.length) {
    drafts.push({
      id: "certificado",
      kind: "certificado",
      title: "Certificado",
      href: `/certificado/${track.id}`,
      moduleIndex: track.modules.length - 1,
      reading: false,
      ok: drafts.every((d) => !d.required || d.ok),
      required: true,
    });
  }

  const nextIndex = drafts.findIndex((d) => d.required && !d.ok);
  const nodes: FlowNode[] = drafts.map((d, i) => ({
    id: d.id,
    kind: d.kind,
    title: d.title,
    href: d.href,
    moduleIndex: d.moduleIndex,
    reading: d.reading,
    current: currentLessonId !== undefined && d.id === `aula:${currentLessonId}`,
    state: d.ok ? "feito" : i === nextIndex ? "proximo" : "pendente",
  }));
  const edges: FlowEdge[] = nodes.slice(1).map((_, i) => ({
    from: i,
    to: i + 1,
    done: nextIndex === -1 || i + 1 <= nextIndex,
  }));
  return { trackId: track.id, color: track.color, nodes, edges, nextIndex };
}

export function stateLabel(n: FlowNode) {
  if (n.state === "feito") return n.kind === "certificado" ? "conquistado" : "concluído";
  if (n.state === "proximo") return "próximo passo";
  return n.reading ? "leitura" : "pendente";
}

// ---------- layout (compartilhado por SVG e 3D) ----------

export type Orientation = "horizontal" | "vertical";
export type Point = { x: number; y: number };
export type Layout = { points: Point[]; width: number; height: number; orientation: Orientation };

/**
 * Posições 2D em unidades abstratas (o SVG usa como viewBox; o 3D multiplica por uma escala).
 * horizontal: zigue-zague em linha, quebrando em "cobra" a cada 12 nós.
 * vertical: zigue-zague numa coluna (celular); o passo encolhe para trilhas longas.
 */
export function layoutFlow(count: number, orientation: Orientation): Layout {
  const n = Math.max(count, 1);
  if (orientation === "vertical") {
    // Celular: a coluna não passa de ~900px mesmo com 30 nós (passo mínimo 26).
    const width = 320;
    const stepY = Math.min(64, Math.max(26, 660 / n));
    const padY = 34;
    const points = Array.from({ length: n }, (_, i) => ({ x: width / 2 + (i % 2 ? 70 : -70), y: padY + i * stepY }));
    return { points, width, height: padY * 2 + (n - 1) * stepY, orientation };
  }
  const rows = Math.ceil(n / 12);
  const perRow = Math.ceil(n / rows);
  const padX = 56;
  const width = Math.max(perRow * 96, 640);
  const stepX = perRow > 1 ? (width - padX * 2) / (perRow - 1) : 0;
  const rowH = 150;
  const padY = 64;
  const points = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow);
    const c = i % perRow;
    const col = row % 2 ? perRow - 1 - c : c;
    return { x: perRow > 1 ? padX + col * stepX : width / 2, y: padY + row * rowH + (i % 2 ? 24 : -24) };
  });
  return { points, width, height: padY * 2 + (rows - 1) * rowH, orientation };
}

/** Pontos de controle de uma curva cúbica entre dois nós (mesma curva no SVG e no 3D). */
export function edgeControls(a: Point, b: Point, orientation: Orientation): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const alongX = orientation === "horizontal" ? Math.abs(dx) >= Math.abs(dy) * 0.6 : Math.abs(dx) > Math.abs(dy);
  return alongX
    ? [{ x: a.x + dx / 2, y: a.y }, { x: b.x - dx / 2, y: b.y }]
    : [{ x: a.x, y: a.y + dy / 2 }, { x: b.x, y: b.y - dy / 2 }];
}

export const PALCO = "#0A0910";
export const SINAL = "#B98AFF";
export const DECISAO = "#FFC857";
export const VIOLETA = "#6D28F5";
