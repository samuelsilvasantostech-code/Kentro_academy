import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function EsqueciPage() {
  return (
    <main className="kauth">
      <div className="kauth-in">
        <Link className="logo" href="/entrar" aria-label="Kentro Academy, voltar para Entrar"><Logo /></Link>
        <ResetRequestForm />
      </div>
    </main>
  );
}
