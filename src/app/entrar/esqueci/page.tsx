import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-form";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function EsqueciPage() {
  return (
    <div className="auth solo">
      <section className="auth-form">
        <div className="auth-stack">
          <Link className="logo" href="/entrar"><span className="logo-mark" aria-hidden><i /></span><span>Kentro <b>Academy</b></span></Link>
          <ResetRequestForm />
        </div>
      </section>
    </div>
  );
}
