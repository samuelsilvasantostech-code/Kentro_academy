import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return (
    <div className="auth solo">
      <section className="auth-form">
        <div className="auth-stack">
          <Link className="logo" href="/"><span className="logo-mark" aria-hidden><i /></span><span>Kentro <b>Academy</b></span></Link>
          <NewPasswordForm />
        </div>
      </section>
    </div>
  );
}
