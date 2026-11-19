"use client";

import { useRef } from "react";

/**
 * Objetos "3D" feitos só com CSS e SVG (sem WebGL): leves, nítidos em qualquer tela e
 * parados quando o sistema pede menos movimento. Todos são decorativos (aria-hidden).
 */

/** Composição do topo (início e login): janela de aula com play, lista de etapas, selo e anel. */
export function HeroArt({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Inclinação leve seguindo o ponteiro; desligada com menos movimento (CSS zera a variável).
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
    el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div className={`hart ${className}`} aria-hidden onPointerMove={move} onPointerLeave={leave}>
      <div className="hart-stage" ref={ref}>
        <span className="hart-orb" />
        <span className="hart-halo" />
        <span className="hart-gem" />
        <span className="hart-note">
          <span><b>✓</b><i /></span>
          <span><b>✓</b><i /></span>
          <span className="cur"><b>▶</b><i /></span>
        </span>
        <span className="hart-cube">
          <svg viewBox="0 0 80 80" fill="none"><path d="M24 15c0-6 6-9 12-5l35 24c6 4 6 9 0 13L36 70c-6 4-12 1-12-5V15z" fill="#fff" stroke="#E4DDFF" strokeWidth="2" /></svg>
        </span>
        <span className="hart-chip">
          <svg viewBox="0 0 44 44" fill="none"><path d="m4 15 18-9 18 9-18 9L4 15z" fill="#7B61ED" stroke="#B6A5FF" strokeWidth="2" /><path d="M12 20v10c6 7 14 7 20 0V20" fill="#A998FC" stroke="#7150D8" strokeWidth="2" /><path d="M40 15v13" stroke="#7150D8" strokeWidth="2.5" strokeLinecap="round" /></svg>
        </span>
      </div>
    </div>
  );
}
