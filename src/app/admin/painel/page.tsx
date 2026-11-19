import Link from "next/link";
import type { Metadata } from "next";
import { getMetrics } from "@/lib/admin/metrics";

export const metadata: Metadata = { title: "Painel" };

const DAY = 86_400_000;
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const ago = (iso: string | null, now: number) => {
  if (!iso) return "Sem atividade";
  const d = Math.floor((now - Date.parse(iso)) / DAY);
  return d <= 0 ? "Hoje" : d === 1 ? "Ontem" : d < 30 ? `Há ${d} dias` : day.format(new Date(iso));
};
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function Painel({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams;
  const m = await getMetrics();
  const now = Date.parse(m.generatedAt);
  const t = m.totals;
  const students = empresa ? m.students.filter((s) => s.company === empresa) : m.students;
  const idle = students.filter((s) => s.lessons > 0 && s.lastActive && now - Date.parse(s.lastActive) > 14 * DAY).length;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Painel</h1>
          <p className="muted">Uso da Academy pelos alunos. Atividade conta aula concluída e quiz feito; o sistema não registra acesso nem tempo assistido.</p>
        </div>
      </div>

      <section aria-label="Resumo" className="pn-kpis">
        <div className="pn-kpi"><b>{t.students}</b><span>{t.students === 1 ? "aluno" : "alunos"}</span><small>{t.newIn30 ? `${t.newIn30} ${t.newIn30 === 1 ? "novo" : "novos"} em 30 dias` : "Nenhum novo em 30 dias"}</small></div>
        <div className="pn-kpi"><b>{t.active7}</b><span>ativos em 7 dias</span><small>{t.active30} em 30 dias</small></div>
        <div className="pn-kpi"><b>{t.lessonsDone}</b><span>aulas concluídas</span><small>Somando todos os alunos</small></div>
        <div className="pn-kpi"><b>{t.certificates}</b><span>{t.certificates === 1 ? "certificado" : "certificados"}</span><small>Trilhas concluídas</small></div>
        <Link className="pn-kpi pn-link" href="/admin/duvidas"><b>{t.pendingQuestions}</b><span>dúvidas sem resposta</span><small>{t.pendingQuestions ? "Abrir a fila" : "Fila vazia"}</small></Link>
      </section>

      <section className="adm-card" aria-labelledby="pn-trilhas">
        <h2 id="pn-trilhas">Trilhas</h2>
        <div className="pn-scroll">
          <table className="pn-table">
            <thead><tr><th scope="col">Trilha</th><th scope="col">Aulas</th><th scope="col">Começaram</th><th scope="col">Progresso médio</th><th scope="col">Concluíram</th></tr></thead>
            <tbody>
              {m.tracks.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}{!r.published && <span className="pn-tag">Rascunho</span>}</th>
                  <td>{r.total}</td>
                  <td>{r.started}</td>
                  <td>{r.started ? <span className="pn-bar"><span className="pbar" aria-hidden><i style={{ width: `${r.avgPct}%` }} /></span>{r.avgPct}%</span> : "—"}</td>
                  <td>{r.certified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adm-sub">Progresso médio entre quem começou, contando as aulas publicadas com vídeo.</p>
      </section>

      <div className="pn-two">
        <section className="adm-card" aria-labelledby="pn-drop">
          <h2 id="pn-drop">Onde os alunos param</h2>
          {m.drops.length ? (
            <ul className="pn-list">
              {m.drops.map((d) => (
                <li key={`${d.trackName}-${d.lessonTitle}`}>
                  <b>{d.lessonTitle}</b>
                  <span className="adm-sub">{d.trackName}: {d.reached} de {d.previous} que fizeram a aula anterior concluíram esta</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Ainda não há queda entre uma aula e a seguinte.</p>}
        </section>

        <section className="adm-card" aria-labelledby="pn-quiz">
          <h2 id="pn-quiz">Quizzes mais difíceis</h2>
          {m.quizzes.length ? (
            <ul className="pn-list">
              {m.quizzes.slice(0, 6).map((q) => (
                <li key={q.moduleId}>
                  <b>{q.moduleTitle}</b>
                  <span className="adm-sub">{q.trackName}: {q.firstTryRate}% passam na primeira tentativa ({pl(q.students, "aluno", "alunos")}, {pl(q.attempts, "tentativa", "tentativas")})</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nenhum quiz feito ainda.</p>}
        </section>
      </div>

      <section className="adm-card" aria-labelledby="pn-alunos">
        <div className="adm-head">
          <div>
            <h2 id="pn-alunos">Alunos</h2>
            <p className="adm-sub">
              {pl(students.length, "aluno", "alunos")}{empresa ? ` de ${empresa}` : ""}, do mais ativo para o menos ativo.
              {idle > 0 && ` ${pl(idle, "começou e está parado", "começaram e estão parados")} há mais de 14 dias.`}
            </p>
          </div>
          {m.companies.length > 1 && (
            <nav className="adm-seg" aria-label="Filtrar por empresa">
              <Link href="/admin/painel" aria-current={empresa ? undefined : "page"}>Todas</Link>
              {m.companies.map((c) => <Link key={c} href={`/admin/painel?empresa=${encodeURIComponent(c)}`} aria-current={empresa === c ? "page" : undefined}>{c}</Link>)}
            </nav>
          )}
        </div>
        {students.length ? (
          <div className="pn-scroll">
            <table className="pn-table">
              <thead><tr><th scope="col">Aluno</th><th scope="col">Empresa</th><th scope="col">Trilha atual</th><th scope="col">Aulas</th><th scope="col">Certificados</th><th scope="col">Última atividade</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{s.name}</th>
                    <td>{s.company ?? "—"}</td>
                    <td>{s.currentTrack ?? "—"}</td>
                    <td>{s.lessons}</td>
                    <td>{s.certs}</td>
                    <td>{ago(s.lastActive, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Nenhum aluno{empresa ? " desta empresa" : ""} ainda.</p>}
      </section>
    </>
  );
}
