"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Boundary, useMedia, useWebGL } from "@/components/flow/FlowStage";
import { CrystalGlyph } from "./CrystalGlyph";

const CrystalScene3D = dynamic(() => import("./CrystalScene3D"), { ssr: false });

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

/**
 * Cristal do topo do início. O SVG vem no HTML do servidor (espaço reservado, sem salto de layout) e
 * fica como versão final com menos movimento, sem WebGL, aparelho fraco ou erro. Caso contrário o 3D é
 * baixado só depois que a página carrega e o cristal aparece na tela, e para quando sai dela ou a aba fica oculta.
 */
export function CrystalHero() {
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
    <div ref={box} className={`kcrystal${use3D && ready ? " is-3d" : ""}`} aria-hidden>
      <CrystalGlyph className="kcrystal-svg" />
      {use3D && (
        <Boundary fallback={null}>
          <div className="kcrystal-gl">
            <CrystalScene3D active={inView && pageVisible} onReady={() => setReady(true)} />
          </div>
        </Boundary>
      )}
    </div>
  );
}
