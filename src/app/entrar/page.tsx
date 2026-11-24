import type { Metadata } from "next";
import { AuthForm } from "./auth-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="kauth">
      <div className="kauth-in">
        <div className="logo"><Logo /></div>
        <AuthForm linkError={erro === "link"} />
      </div>
    </main>
  );
}
