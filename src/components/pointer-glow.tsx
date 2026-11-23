"use client";

import { useEffect } from "react";

/**
 * Brilho que segue o cursor nos cartões com a classe "kglow" (a posição vai em --mx/--my e o CSS desenha a luz).
 * Atualiza no máximo uma vez por quadro e só mede o cartão ao entrar nele. Só em telas com mouse; no toque e
 * com movimento reduzido nada acontece.
 */
export function PointerGlow() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    let el: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let x = 0, y = 0, raf = 0;
    const paint = () => {
      raf = 0;
      if (!el || !rect) return;
      el.style.setProperty("--mx", `${x - rect.left}px`);
      el.style.setProperty("--my", `${y - rect.top}px`);
    };
    const move = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest?.(".kglow") as HTMLElement | null;
      if (!hit) { el = null; return; }
      if (hit !== el) { el = hit; rect = hit.getBoundingClientRect(); }
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const reset = () => { el = null; };
    document.addEventListener("pointermove", move, { passive: true });
    addEventListener("scroll", reset, { passive: true });
    addEventListener("resize", reset);
    return () => {
      document.removeEventListener("pointermove", move);
      removeEventListener("scroll", reset);
      removeEventListener("resize", reset);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
