import Link from "next/link";
import { stateLabel, type Flow, type FlowNode } from "./model";

const WINDOW = 9;

function Mark({ n }: { n: FlowNode }) {
  const cur = !!n.current;
  return (
    <svg className={n.state === "feito" ? "fs-pop" : undefined} viewBox="-16 -16 32 32" width="32" height="32" aria-hidden focusable="false">
      {n.state === "proximo" && !cur && <circle r="14" fill="none" className="fs-pulse" />}
      {n.kind === "quiz" ? (
        <path d="M0-12L12 0L0 12L-12 0Z" className={`fs-q ${n.state}`} />
      ) : n.kind === "certificado" ? (
        <>
          <circle r="12" className={`fs-c ${n.state}`} />
          <circle r="6" className="fs-c-in" />
        </>
      ) : (
        <circle r={n.reading ? 7 : 10} className={`fs-n ${n.state}`} strokeDasharray={n.reading ? "3 3" : undefined} style={{ stroke: n.state === "pendente" ? "var(--fs-tint)" : undefined }} />
      )}
      {n.state === "feito" && n.kind === "aula" && !n.reading && <path d="M-4.5 0.5L-1.5 3.5L4.5-3" className="fs-ck" />}
      {cur && <circle r="15" className="fs-cur" />}
    </svg>
  );
}

/**
 * Faixa 2D compacta para a página da aula: janela de até 9 etapas em volta da aula atual.
 * Etapas concluídas em --sinal, a atual com anel, as próximas pendentes. Sem 3D.
 */
export function FlowStrip({ flow, label, caption }: { flow: Flow; label: string; caption?: string }) {
  const cur = flow.nodes.findIndex((n) => n.current);
  if (cur < 0) return null;
  const total = flow.nodes.length;
  let start = Math.max(0, cur - Math.floor(WINDOW / 2));
  const end = Math.min(total, start + WINDOW);
  start = Math.max(0, end - WINDOW);
  const items = flow.nodes.slice(start, end);
  return (
    <nav className="fstrip" aria-label={label} style={{ ["--fs-tint" as string]: flow.color }}>
      <ol>
        {start > 0 && <li className="fs-more" aria-hidden>+{start}</li>}
        {items.map((n, k) => {
          const i = start + k;
          const lit = i > 0 && flow.edges[i - 1]?.done;
          return (
            <li key={n.id} className={lit ? "lit" : undefined} style={{ ["--fs-d" as string]: `${k * 60}ms` }} data-first={k === 0 && start === 0 ? "" : undefined}>
              <Link href={n.href} aria-current={n.current ? "step" : undefined} aria-label={`${n.title} (${n.current ? "você está aqui" : stateLabel(n)})`} title={n.title}>
                <Mark n={n} />
              </Link>
            </li>
          );
        })}
        {end < total && <li className="fs-more" aria-hidden>+{total - end}</li>}
      </ol>
      {caption && <p className="fs-cap">{caption}</p>}
    </nav>
  );
}
