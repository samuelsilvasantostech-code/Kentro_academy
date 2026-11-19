import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function EsqueciPage() {
  return (
    <div className="auth solo">
      <section className="auth-form">
        <div className="auth-stack">
          <Link className="logo" href="/entrar"><Logo /></Link>
          <ResetRequestForm />
        </div>
      </section>
    </div>
  );
}
