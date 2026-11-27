import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/db/auth";
import { NewPasswordForm } from "./new-password-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Nova senha" };

export default async function RedefinirSenhaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return (
    <div className="auth solo">
      <section className="auth-form">
        <div className="auth-stack">
          <Link className="logo" href="/"><Logo /></Link>
          <NewPasswordForm />
        </div>
      </section>
    </div>
  );
}
