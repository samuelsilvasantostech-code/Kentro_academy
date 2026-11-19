"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/admin/painel", "Painel"],
  ["/admin/trilhas", "Trilhas"],
  ["/admin/aulas", "Aulas"],
  ["/admin/quizzes", "Quizzes"],
  ["/admin/duvidas", "Dúvidas"],
  ["/admin/novidades", "Novidades"],
] as const;

export function AdminNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Seções do painel" className="adm-tabs">
      {TABS.map(([href, label]) => {
        const current = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className="adm-tab" aria-current={current ? "page" : undefined}>
            {label}
            {href === "/admin/duvidas" && pending > 0 && (
              <span className="adm-count" aria-label={`${pending} ${pending === 1 ? "dúvida sem resposta" : "dúvidas sem resposta"}`}>{pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
