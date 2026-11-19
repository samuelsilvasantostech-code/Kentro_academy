import Link from "next/link";
import type { Metadata } from "next";
import { Ico } from "@/components/ico";

// Neutro de propósito: o layout do /admin define "Admin" no título, e o aluno não deve ver isso num 404.
export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="state full">
      <div className="state-in">
        <div className="logo">Kentro<b>Academy</b></div>
        {/* O fluxo interrompido: o conector não chega ao último nó. */}
        <svg className="nf-flow" viewBox="0 0 220 56" fill="none" aria-hidden="true" focusable="false">
          <circle cx="24" cy="28" r="10" className="nf-on" />
          <path d="M34 28h52" className="nf-line" />
          <rect x="90" y="18" width="20" height="20" rx="3" transform="rotate(45 100 28)" className="nf-on" />
          <path d="M114 28h30" className="nf-line" />
          <path d="M152 28h14" className="nf-line nf-off" strokeDasharray="3 6" />
          <circle cx="196" cy="28" r="10" className="nf-ghost" strokeDasharray="4 4" />
        </svg>
        <p className="state-n" aria-hidden="true">404</p>
        <h1>Esta página não existe</h1>
        <p className="muted">O endereço pode ter mudado ou você não tem acesso a ele. Volte ao início para continuar de onde parou.</p>
        <div className="state-btns">
          <Link className="btn btn-p" href="/"><Ico name="home" />Ir para o início</Link>
        </div>
      </div>
    </div>
  );
}
