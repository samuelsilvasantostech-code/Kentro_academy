"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ico, type IcoName } from "@/components/ico";

const section = (p: string) =>
  p === "/" ? "home" : /^\/(trilha|aula|quiz)/.test(p) ? "trilhas" : /^\/(meu|certificado)/.test(p) ? "meu" : p.split("/")[1];

const ITEMS: [href: string, key: string, icon: IcoName, label: string][] = [
  ["/", "home", "home", "Início"],
  ["/trilhas", "trilhas", "layers", "Trilhas"],
  ["/meu", "meu", "video", "Meus cursos"],
  ["/ajuda", "ajuda", "help", "Ajuda"],
];

export function NavLinks() {
  const s = section(usePathname());
  return (
    <nav className="nav" aria-label="Navegação principal">
      {ITEMS.map(([href, k, icon, label]) => (
        <Link key={k} href={href} className={s === k ? "on" : ""} aria-current={s === k ? "page" : undefined}>
          <Ico name={icon} size={17} />{label}
        </Link>
      ))}
    </nav>
  );
}

/** Barra inferior do celular: as mesmas seções do topo, mais a busca. */
export function BottomNav() {
  const s = section(usePathname());
  const items: typeof ITEMS = [ITEMS[0], ITEMS[1], ["/buscar", "buscar", "search", "Buscar"], ITEMS[2], ITEMS[3]];
  return (
    <nav className="bnav" aria-label="Navegação">
      {items.map(([href, k, icon, label]) => (
        <Link key={k} href={href} className={s === k ? "on" : ""} aria-current={s === k ? "page" : undefined}>
          <Ico name={icon} size={20} />{label}
        </Link>
      ))}
    </nav>
  );
}
