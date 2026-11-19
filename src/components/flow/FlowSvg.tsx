import type { CSSProperties } from "react";
import Link from "next/link";
import { DECISAO, PALCO, SINAL, VIOLETA, edgeControls, layoutFlow, stateLabel, type Flow, type FlowNode, type Orientation } from "./model";

const sinal = `var(--sinal, ${SINAL})`;
const decisao = `var(--decisao, ${DECISAO})`;
const violeta = `var(--violeta, ${VIOLETA})`;
const palco = `var(--palco, ${PALCO})`;

// Estilos da animação ficam aqui para o componente não depender do globals.css.
const CSS = `
@keyframes kf-pulse{0%{transform:scale(.8);opacity:.9}100%{transform:scale(2.1);opacity:0}}
.kf-pulse{transform-box:fill-box;transform-origin:center;animation:kf-pulse 1.8s ease-out infinite}
.kf-node{outline:none;cursor:pointer}
.kf-focus{opacity:0}
.kf-node:focus-visible .kf-focus{opacity:1}
.kf-node:hover .kf-hover{opacity:1}
.kf-hover{opacity:0}
.kf-edge-done{transition:filter .2s ease}
.kf-draw{stroke-dasharray:1 2;stroke-dashoffset:0;animation:kf-draw var(--kf-dur,.4s) var(--kf-ease,linear) var(--kf-d,0ms) backwards}
@keyframes kf-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.kf-pop{transform-box:fill-box;transform-origin:center;animation:kf-in .32s cubic-bezier(.22,.8,.3,1) var(--kf-d,0ms) backwards}
@keyframes kf-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.kf-pulse{animation:none;opacity:.55;transform:scale(1.5)}.kf-draw,.kf-pop{animation:none}}
`;

// Entrada ao carregar (só no modo full): o traço do sinal se desenha do início ao nó atual em ~650ms
// e os nós concluídos aparecem em sequência, acompanhando o traço.
const DRAW_MS = 650;

type Props = {
  flow: Flow;
  /** compact: miniatura de card (sem rótulos, não interativa). full: nós clicáveis. */
  size?: "compact" | "full";
  orientation?: Orientation;
  className?: string;
};

function Shape({ n, color, r, state }: { n: FlowNode; color: string; r: number; state: FlowNode["state"] }) {
  const done = state === "feito";
  const next = state === "proximo";
  const sw = r * 0.22;
  // Concluído é sempre --sinal (progresso igual em toda trilha); a tinta da trilha só aparece nos pendentes.
  const stroke = next || done ? sinal : color;
  if (n.kind === "quiz") {
    const s = r * 1.15;
    return (
      <path
        d={`M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z`}
        style={{ fill: done ? sinal : next ? palco : "none", stroke: done ? sinal : decisao, strokeWidth: sw, strokeOpacity: done || next ? 1 : 0.55, strokeLinejoin: "round" }}
      />
    );
  }
  if (n.kind === "certificado") {
    return (
      <g>
        <circle r={r * 1.3} style={{ fill: done ? violeta : palco, stroke: done ? sinal : violeta, strokeWidth: sw, strokeOpacity: done || next ? 1 : 0.6 }} />
        <circle r={r * 0.62} style={{ fill: "none", stroke: done ? "#fff" : violeta, strokeWidth: sw * 0.7, strokeOpacity: done ? 0.9 : 0.6 }} />
      </g>
    );
  }
  return (
    <circle
      r={n.reading ? r * 0.7 : r}
      style={{
        fill: done ? sinal : next ? palco : "none",
        stroke,
        strokeWidth: sw,
        strokeOpacity: done || next ? 1 : 0.5,
        strokeDasharray: n.reading ? `${sw * 1.4} ${sw * 1.2}` : undefined,
      }}
    />
  );
}

/** Fluxo da trilha em 2D. Mesmo desenho na miniatura (compact) e na cena principal (full). */
export function FlowSvg({ flow, size = "full", orientation = "horizontal", className }: Props) {
  const compact = size === "compact";
  const { points, width, height } = layoutFlow(flow.nodes.length, compact ? "horizontal" : orientation);
  const o = compact ? "horizontal" : orientation;
  const k = compact ? 1.9 : 1;
  const r = 13 * k;
  const doneEdges = flow.edges.filter((e) => e.done).length;
  const step = DRAW_MS / Math.max(doneEdges, 1);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role={compact ? "img" : "group"}
      aria-label={compact ? `Fluxo da trilha ${flow.trackId}` : "Fluxo da trilha"}
      aria-hidden={compact || undefined}
      style={{ display: "block", width: "100%", height: "100%", background: palco }}
    >
      <style>{CSS}</style>
      {flow.edges.map((e, ei) => {
        const a = points[e.from];
        const b = points[e.to];
        const [c1, c2] = edgeControls(a, b, o);
        return (
          <path
            key={`${e.from}-${e.to}`}
            d={`M${a.x} ${a.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`}
            fill="none"
            strokeLinecap="round"
            pathLength={e.done && !compact ? 1 : undefined}
            className={e.done ? (compact ? "kf-edge-done" : "kf-edge-done kf-draw") : undefined}
            style={{
              stroke: e.done ? sinal : "#fff",
              strokeOpacity: e.done ? 1 : 0.22,
              strokeWidth: (e.done ? 4 : 3) * k,
              ...(e.done && !compact ? ({ "--kf-d": `${Math.round(ei * step)}ms`, "--kf-dur": `${Math.round(step)}ms`, "--kf-ease": doneEdges === 1 ? "cubic-bezier(.22,.61,.36,1)" : "linear" } as CSSProperties) : null),
            }}
          />
        );
      })}
      {flow.nodes.map((n, i) => {
        const p = points[i];
        const pop = !compact && n.state === "feito";
        const body = (
          <g className={pop ? "kf-pop" : undefined} style={pop ? ({ "--kf-d": `${Math.max(0, Math.round(i * step) - 80)}ms` } as CSSProperties) : undefined}>
            {n.state === "proximo" && <circle className="kf-pulse" r={r * 1.1} style={{ fill: "none", stroke: sinal, strokeWidth: 3 * k }} />}
            <Shape n={n} color={flow.color} r={r} state={n.state} />
            {n.state === "feito" && n.kind === "aula" && !n.reading && (
              <path d={`M${-r * 0.4} 0L${-r * 0.1} ${r * 0.32}L${r * 0.45} ${-r * 0.3}`} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: palco, strokeWidth: r * 0.22 }} />
            )}
          </g>
        );
        if (compact) return <g key={n.id} transform={`translate(${p.x} ${p.y})`}>{body}</g>;
        return (
          <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
            <Link href={n.href} className="kf-node" aria-label={`${n.title} (${stateLabel(n)})`}>
              <title>{n.title}</title>
              <circle className="kf-hover" r={r * 1.7} style={{ fill: "#fff", fillOpacity: 0.08 }} />
              <circle className="kf-focus" r={r * 1.7} style={{ fill: "none", stroke: "#fff", strokeWidth: 2.5 }} />
              {/* área de clique generosa */}
              <circle r={r * 1.7} fill="transparent" />
              {body}
            </Link>
          </g>
        );
      })}
    </svg>
  );
}
