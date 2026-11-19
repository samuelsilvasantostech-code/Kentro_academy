"use client";

import { useEffect } from "react";

/**
 * Brilho que segue o cursor nos cartões com a classe "kglow" (a posição vai em --mx/--my e o CSS desenha a luz).
 * Só em telas com mouse; no toque e com movimento reduzido nada acontece.
 */
export function PointerGlow() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".kglow") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return null;
}
