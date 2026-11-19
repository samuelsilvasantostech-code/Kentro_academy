import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getMe } from "@/lib/catalog";
import { getTrackStatuses } from "../completion";
import { Ico } from "@/components/ico";
import { PrintButton } from "./print-button";
import { nextTrack } from "@/lib/next-track";
import { CertSeal } from "@/components/crystal/CertSeal";

export const metadata: Metadata = { title: "Certificado" };

const dateBR = (iso: string | null) =>
  new Date(iso ?? Date.now()).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function Certificado({ params }: { params: Promise<{ trilha: string }> }) {
  const { trilha } = await params;
  const [{ profile }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const t = tracks.find((x) => x.id === trilha);
  if (!t) notFound();

  const statuses = await getTrackStatuses();
  const st = statuses.get(t.id);

  if (!st?.certified) {
    return (
      <div className="empty">
        <span className="empty-ico" aria-hidden="true"><Ico name="lock" size={28} /></span>
        <h1>Conclua a trilha para liberar o certificado</h1>
        <p className="muted">Faça todas as aulas e os quizzes de {t.name} para receber o seu.</p>
        <Link className="btn btn-p" href={`/trilha/${t.id}`}>Ir para a trilha<Ico name="arrowR" /></Link>
      </div>
    );
  }

  const name = profile.full_name?.trim();
  if (!name) {
    return (
      <div className="empty">
        <span className="empty-ico" aria-hidden="true"><Ico name="pen" size={28} /></span>
        <h1>Complete seu nome para emitir o certificado</h1>
        <p className="muted">Seu perfil está sem nome. Preencha em Meu aprendizado e volte aqui.</p>
        <Link className="btn btn-p" href="/meu#nome"><Ico name="pen" />Preencher meu nome</Link>
      </div>
    );
  }

  const issued = new Date(st.issuedAt as string); // certificado existe => issuedAt preenchido
  // "Adicionar ao perfil" do LinkedIn: o aluno confere e salva lá. Vai só o nome da trilha e a data, nada do aluno.
  const linkedin = `https://www.linkedin.com/profile/add?${new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: t.name,
    organizationName: "Kentro Academy",
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
  })}`;
  const nx = nextTrack(tracks, t.id, (id) => !!statuses.get(id)?.certified);

  return (
    <>
      <div className="cert-actions">
        <Link className="btn btn-s" href={`/trilha/${t.id}`}><Ico name="arrowL" />Voltar à trilha</Link>
        <a className="btn btn-s" href={linkedin} target="_blank" rel="noopener noreferrer">Adicionar ao LinkedIn<span className="sr-only"> (abre em nova aba)</span></a>
        <PrintButton />
      </div>
      <section className="cert-hero" aria-labelledby="cert-hero-t">
        <CertSeal />
        <div className="cert-hero-tx">
          <p className="cert-hero-k">Trilha concluída</p>
          <h2 id="cert-hero-t">Parabéns, {name.split(/\s+/)[0]}!</h2>
          <p className="muted">Você concluiu <b>{t.name}</b> em {dateBR(st.issuedAt)}. Seu certificado está logo abaixo: imprima, salve em PDF ou adicione ao LinkedIn.</p>
        </div>
      </section>
      {st.hasNew && <p className="muted cert-note">Esta trilha ganhou conteúdo novo depois da sua conclusão. Seu certificado continua valendo.</p>}
      <article className="cert-sheet" aria-label={`Certificado de ${name}`}>
        <div className="cert-in">
          <div className="cert-logo">Kentro<b>Academy</b></div>
          <div className="cert-body">
            <p className="cert-k">Certificado de conclusão</p>
            <p className="cert-p">Certificamos que</p>
            <h1 className="cert-name">{name}</h1>
            <p className="cert-p">concluiu a trilha</p>
            <p className="cert-track">{t.name}</p>
            <p className="cert-p">na Kentro Academy em {dateBR(st.issuedAt)}.</p>
          </div>
          <div className="cert-foot">
            <svg className="cert-seal" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
              <circle cx="32" cy="32" r="29" strokeWidth="2" />
              <circle cx="32" cy="32" r="23" strokeWidth="1.5" strokeDasharray="2 3.2" />
              <path d="M21.5 33l7.5 7.5L43 25" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="cert-sign"><span>Equipe Kentro Academy</span></div>
          </div>
        </div>
      </article>
      {nx && (
        <aside className="khelp next-track cert-next">
          <div><h2>Próxima trilha: {nx.name}</h2><p>{nx.pitch}</p></div>
          <Link className="btn btn-p" href={`/trilha/${nx.id}`}>Ver a trilha<Ico name="arrowR" /></Link>
        </aside>
      )}
    </>
  );
}
