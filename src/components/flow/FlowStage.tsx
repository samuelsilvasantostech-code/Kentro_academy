"use client";

import { Component, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { HubSvg } from "./HubSvg";
import { PALCO, type Flow } from "./model";
import { StageSvgs, STAGE_CSS, stageVars } from "./stage";

const FlowScene3D = dynamic(() => import("./FlowScene3D"), { ssr: false });
const HubScene3D = dynamic(() => import("./HubScene3D"), { ssr: false });

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

let webglCache: boolean | undefined;
function detectWebGL() {
  if (webglCache === undefined) {
    try {
      const c = document.createElement("canvas");
      webglCache = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}
const noop = () => () => {};
export const useWebGL = () => useSyncExternalStore(noop, detectWebGL, () => false);

/** Se a cena 3D falhar (contexto perdido, erro de shader), o SVG assume sem derrubar a página. */
export class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Fluxo da trilha: 3D quando possível. O SVG fica só como fallback (sem WebGL, erro na cena) e enquanto o 3D carrega.
 * Com `prefers-reduced-motion: reduce` a cena 3D continua aparecendo, mas parada (um único frame, sem parallax,
 * sem sinal percorrendo e sem pulso). A altura vem da proporção do layout e não muda entre os dois.
 */
export function FlowStage({ flow, className }: { flow: Flow; className?: string }) {
  const vertical = useMedia("(max-width: 640px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const webgl = useWebGL();
  const [ready, setReady] = useState(false);
  const use3D = webgl && flow.nodes.length > 0;
  const hideSvg = use3D && ready;

  return (
    <div
      className={`kf-stage${className ? ` ${className}` : ""}`}
      data-flow-stage={hideSvg ? "3d" : "svg"}
      style={stageVars(flow.nodes.length, `var(--palco, ${PALCO})`)}
    >
      <style>{STAGE_CSS}</style>
      <div style={{ position: "absolute", inset: 0, visibility: hideSvg ? "hidden" : "visible" }}>
        <StageSvgs flow={flow} />
      </div>
      {use3D && (
        <Boundary fallback={null}>
          <div aria-hidden style={{ position: "absolute", inset: 0 }}>
            <FlowScene3D flow={flow} vertical={vertical} still={reduced} onReady={() => setReady(true)} />
          </div>
        </Boundary>
      )}
    </div>
  );
}

/**
 * Cena do login: o hub Kentro com canais em órbita. Preenche o pai (que define a altura).
 * Com `prefers-reduced-motion: reduce` a cena aparece parada (um único frame); o SVG é só fallback.
 */
export function HubStage({ className }: { className?: string }) {
  const [ready, setReady] = useState(false);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const webgl = useWebGL();
  const use3D = webgl;
  return (
    <div className={className} data-flow-stage={use3D && ready ? "3d" : "svg"} style={{ position: "relative", width: "100%", height: "100%", minHeight: 240, background: `var(--palco, ${PALCO})`, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, visibility: use3D && ready ? "hidden" : "visible" }}>
        <HubSvg />
      </div>
      {use3D && (
        <Boundary fallback={null}>
          <div aria-hidden style={{ position: "absolute", inset: 0 }}>
            <HubScene3D still={reduced} onReady={() => setReady(true)} />
          </div>
        </Boundary>
      )}
    </div>
  );
}
