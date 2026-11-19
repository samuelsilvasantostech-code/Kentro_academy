import type { Metadata } from "next";
import { HeroArt } from "@/components/art";
import { Ico } from "@/components/ico";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Entrar" };

const POINTS = ["Aulas curtas com passo a passo", "Seu progresso sempre salvo", "Certificado ao concluir a trilha"];

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <div className="klogin">
      <div className="klogin-in">
        <section className="klogin-copy">
          <div className="logo"><span className="logo-mark" aria-hidden><i /></span><span>Kentro <b>Academy</b></span></div>
          <h1>Domine o Kentro<br /><span>no seu ritmo.</span></h1>
          <p>Trilhas curtas para cada função, do primeiro atendimento às automações. Aprenda na prática e continue de onde parou.</p>
          <ul className="klogin-pts">
            {POINTS.map((p) => <li key={p}><Ico name="check" size={16} strokeWidth={2.6} />{p}</li>)}
          </ul>
          <HeroArt className="hart-login" />
        </section>
        <main className="klogin-card">
          <span className="klogin-ico" aria-hidden><Ico name="lock" size={22} /></span>
          <AuthForm linkError={erro === "link"} />
        </main>
      </div>
    </div>
  );
}
