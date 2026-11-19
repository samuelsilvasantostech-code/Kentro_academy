"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Boundary, useMedia, useWebGL } from "@/components/flow/FlowStage";

function usePageVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const on = () => setV(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

/** Aparelho fraco ou economia de dados: fica a imagem fixa. */
function lowPower() {
  const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return !!n.connection?.saveData || (n.deviceMemory !== undefined && n.deviceMemory < 4) || (navigator.hardwareConcurrency || 8) < 4;
}

export type SceneProps = { active: boolean; onReady?: () => void };

/**
 * Palco de uma cena 3D decorativa. O `fallback` (SVG) vem no HTML do servidor e fica como versão final com
 * menos movimento, sem WebGL, aparelho fraco ou erro. Caso contrário a cena (import dinâmico, sem SSR) só é
 * baixada depois que a página fica ociosa e o palco aparece na tela; para fora dela ou com a aba oculta.
 * Classes: `${base}` no palco, `${base}-gl` na camada do canvas e `is-3d` quando a cena já desenhou.
 */
export function Lazy3D({ base, fallback, Scene }: { base: string; fallback: ReactNode; Scene: ComponentType<SceneProps> }) {
  const box = useRef<HTMLDivElement>(null);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const webgl = useWebGL();
  const pageVisible = usePageVisible();
  const [want, setWant] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || reduced || !webgl || lowPower()) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    // Depois do LCP: espera o navegador ficar ocioso antes de baixar three.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setWant(true), { timeout: 2500 }) : window.setTimeout(() => setWant(true), 1200);
    return () => {
      io.disconnect();
      if (w.cancelIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id);
    };
  }, [reduced, webgl]);

  const use3D = want && webgl && !reduced;
  return (
    <div ref={box} className={`${base}${use3D && ready ? " is-3d" : ""}`} aria-hidden>
      {fallback}
      {use3D && (
        <Boundary fallback={null}>
          <div className={`${base}-gl`}>
            <Scene active={inView && pageVisible} onReady={() => setReady(true)} />
          </div>
        </Boundary>
      )}
    </div>
  );
}
