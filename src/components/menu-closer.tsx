"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fecha o menu da conta (<details class="menu">) com Esc (devolvendo o foco ao botão),
 * com clique fora dele e ao trocar de página.
 */
export function MenuCloser() {
  const path = usePathname();

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>("details.menu[open]").forEach((d) => (d.open = false));
  }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>("details.menu[open]").forEach((d) => {
        d.open = false;
        d.querySelector("summary")?.focus();
      });
    };
    const onClick = (e: MouseEvent) => {
      document.querySelectorAll<HTMLDetailsElement>("details.menu[open]").forEach((d) => {
        if (!d.contains(e.target as Node)) d.open = false;
      });
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
