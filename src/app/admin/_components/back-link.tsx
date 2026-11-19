import Link from "next/link";
import { Ico } from "@/components/ico";

/** Link de volta no topo das telas de edição: ícone SVG em vez de seta digitada. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="adm-back" href={href}><Ico name="arrowL" size={16} />{children}</Link>;
}
