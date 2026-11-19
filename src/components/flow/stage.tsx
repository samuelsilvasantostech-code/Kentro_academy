import type { CSSProperties } from "react";
import { FlowSvg } from "./FlowSvg";
import { layoutFlow, type Flow } from "./model";

// A orientação do SVG é escolhida por CSS (mesmo breakpoint de `vertical` em FlowStage), então o HTML do
// servidor já sai com a altura certa e não há salto de layout na hidratação.
export const STAGE_CSS = `
.kf-stage{position:relative;width:100%;min-width:0;contain:inline-size;aspect-ratio:var(--kf-h);min-height:240px;border-radius:20px;overflow:hidden}
.kf-stage .kf-v{display:none}
@media (max-width:640px){
  .kf-stage{aspect-ratio:var(--kf-v);min-height:0;max-height:900px}
  .kf-stage .kf-h{display:none}
  .kf-stage .kf-v{display:block}
}
`;

export function stageVars(count: number, background: string) {
  const h = layoutFlow(count, "horizontal");
  const v = layoutFlow(count, "vertical");
  return { "--kf-h": `${h.width} / ${h.height}`, "--kf-v": `${v.width} / ${v.height}`, background } as CSSProperties;
}

/** Os dois SVGs (horizontal e vertical); o CSS mostra um deles. */
export function StageSvgs({ flow }: { flow: Flow }) {
  return (
    <>
      <div className="kf-h" style={{ width: "100%", height: "100%" }}>
        <FlowSvg flow={flow} size="full" orientation="horizontal" />
      </div>
      <div className="kf-v" style={{ width: "100%", height: "100%" }}>
        <FlowSvg flow={flow} size="full" orientation="vertical" />
      </div>
    </>
  );
}

/**
 * Fluxo só em SVG, com a mesma moldura e proporção do FlowStage, mas sem three.
 * Usado onde o 3D não é necessário (início): o JS da cena 3D nem é baixado.
 */
export function FlowSvgStage({ flow, className }: { flow: Flow; className?: string }) {
  return (
    <div className={`kf-stage${className ? ` ${className}` : ""}`} data-flow-stage="svg" style={stageVars(flow.nodes.length, "transparent")}>
      <style>{STAGE_CSS}</style>
      <div style={{ position: "absolute", inset: 0 }}>
        <StageSvgs flow={flow} />
      </div>
    </div>
  );
}
