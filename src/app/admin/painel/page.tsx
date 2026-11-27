import Link from "next/link";
import type { Metadata } from "next";
import { getMetrics } from "@/lib/admin/metrics";
import { getAdminLessons, getAdminTracks } from "@/lib/admin/queries";
import { Ico, type IcoName } from "@/components/ico";

export const metadata: Metadata = { title: "Painel" };

const DAY = 86_400_000;
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const ago = (iso: string | null, now: number) => {
  if (!iso) return "Sem atividade";
  const d = Math.floor((now - Date.parse(iso)) / DAY);
  return d <= 0 ? "Hoje" : d === 1 ? "Ontem" : d < 30 ? `Há ${d} dias` : day.format(new Date(iso));
};
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
type Todo = { icon: IcoName; tone: "alert" | "info"; title: string; desc: string; href: string; cta: string };

export default async function Painel({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams;
  const [m, tracks, lessons] = await Promise.all([getMetrics(), getAdminTracks(), getAdminLessons()]);
  const now = Date.parse(m.generatedAt);
  const t = m.totals;
  const students = empresa ? m.students.filter((s) => s.company === empresa) : m.students;
  const idle = students.filter((s) => s.lessons > 0 && s.lastActive && now - Date.parse(s.lastActive) > 14 * DAY).length;
  const idleAll = m.students.filter((s) => s.lessons > 0 && s.lastActive && now - Date.parse(s.lastActive) > 14 * DAY).length;

  // Fila de ações: o que a equipe pode resolver agora, do mais urgente para o menos urgente.
  const noQuiz = tracks.filter((tr) => tr.published).flatMap((tr) => tr.modules.filter((md) => md.quizCount === 0 && md.lessons.some((l) => l.published)).map((md) => ({ ...md, track: tr.name })));
  const draftTracks = tracks.filter((tr) => !tr.published);
  const draftLessons = lessons.filter((l) => !l.published).length;
  const loose = lessons.filter((l) => l.links.length === 0).length;
  const hardQuiz = m.quizzes.filter((q) => q.attempts >= 5 && q.firstTryRate < 50);
  const todo: Todo[] = [];
  if (t.pendingQuestions) todo.push({ icon: "chat", tone: "alert", title: pl(t.pendingQuestions, "dúvida sem resposta", "dúvidas sem resposta"), desc: "Alunos esperando retorno. Responda pela fila de dúvidas.", href: "/admin/duvidas", cta: "Responder" });
  if (hardQuiz.length) todo.push({ icon: "target", tone: "info", title: pl(hardQuiz.length, "quiz difícil demais", "quizzes difíceis demais"), desc: `Menos da metade passa de primeira em ${hardQuiz.slice(0, 2).map((q) => q.moduleTitle).join(" e ")}. Revise as perguntas ou a aula.`, href: `/admin/quizzes/${hardQuiz[0].moduleId}`, cta: "Revisar" });
  if (noQuiz.length) todo.push({ icon: "help", tone: "info", title: pl(noQuiz.length, "módulo publicado sem quiz", "módulos publicados sem quiz"), desc: `O aluno conclui esses módulos só assistindo às aulas. Um quiz ajuda a fixar o conteúdo. Ex.: ${noQuiz.slice(0, 2).map((x) => `${x.title} (${x.track})`).join("; ")}${noQuiz.length > 2 ? "…" : ""}`, href: `/admin/quizzes/${noQuiz[0].id}`, cta: noQuiz.length > 1 ? "Criar o primeiro quiz" : "Criar quiz" });
  if (draftLessons) todo.push({ icon: "pen", tone: "info", title: pl(draftLessons, "aula em rascunho", "aulas em rascunho"), desc: "Os alunos não veem rascunhos. Publique quando estiverem prontas.", href: "/admin/aulas?status=rascunho", cta: "Ver rascunhos" });
  if (draftTracks.length) todo.push({ icon: "layers", tone: "info", title: pl(draftTracks.length, "trilha em rascunho", "trilhas em rascunho"), desc: draftTracks.slice(0, 3).map((x) => x.name).join(", "), href: `/admin/trilhas/${draftTracks[0].id}`, cta: draftTracks.length > 1 ? "Abrir a primeira trilha" : "Abrir trilha" });
  if (loose) todo.push({ icon: "inbox", tone: "info", title: pl(loose, "aula fora de qualquer módulo", "aulas fora de qualquer módulo"), desc: "Aulas soltas não aparecem em nenhuma trilha.", href: "/admin/aulas?trilha=sem-modulo", cta: "Organizar" });
  if (idleAll) todo.push({ icon: "sleep", tone: "info", title: pl(idleAll, "aluno parado há mais de 14 dias", "alunos parados há mais de 14 dias"), desc: "Começaram uma trilha e não concluem aula nem quiz há duas semanas.", href: "#pn-alunos", cta: "Ver alunos" });

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Painel</h1>
          <p className="muted">Como os alunos usam a Kentro Academy. Atividade é concluir uma aula ou fazer um quiz. Acessos e tempo assistido não são registrados.</p>
        </div>
      </div>

      <section className="adm-card pn-todo" aria-labelledby="pn-todo">
        <div className="pn-todo-h">
          <h2 id="pn-todo">O que fazer agora</h2>
          {todo.length > 0 && <span className="pn-todo-n">{todo.length}</span>}
        </div>
        {todo.length ? (
          <ul className="pn-todo-list">
            {todo.map((x) => (
              <li key={x.title} className={`pn-todo-i is-${x.tone}`}>
                <span className="pn-todo-ico" aria-hidden><Ico name={x.icon} size={18} /></span>
                <div className="pn-todo-tx"><b>{x.title}</b><span>{x.desc}</span></div>
                <Link className="btn btn-s btn-sm" href={x.href}>{x.cta}<span className="sr-only">: {x.title}</span></Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pn-todo-ok"><Ico name="check" size={18} strokeWidth={3} />Tudo em dia: nenhuma dúvida esperando e nada pendente no conteúdo.</p>
        )}
      </section>

      <section aria-label="Resumo" className="pn-kpis">
        <div className="pn-kpi"><b>{t.students}</b><span>{t.students === 1 ? "aluno" : "alunos"}</span><small>{t.newIn30 ? `${t.newIn30} ${t.newIn30 === 1 ? "novo" : "novos"} em 30 dias` : "Nenhum novo em 30 dias"}</small></div>
        <div className="pn-kpi"><b>{t.active7}</b><span>ativos em 7 dias</span><small>{t.active30} em 30 dias</small></div>
        <div className="pn-kpi"><b>{t.lessonsDone}</b><span>{t.lessonsDone === 1 ? "aula concluída" : "aulas concluídas"}</span><small>Somando todos os alunos</small></div>
        <div className="pn-kpi"><b>{t.certificates}</b><span>{t.certificates === 1 ? "certificado" : "certificados"}</span><small>Trilhas concluídas</small></div>
        <Link className="pn-kpi pn-link" href="/admin/duvidas"><b>{t.pendingQuestions}</b><span>{t.pendingQuestions === 1 ? "dúvida sem resposta" : "dúvidas sem resposta"}</span><small>{t.pendingQuestions ? "Abrir a fila" : "Fila vazia"}</small></Link>
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
                  <td>{r.started ? <span className="pn-bar"><span className="pbar" aria-hidden><i style={{ width: `${r.avgPct}%` }} /></span>{r.avgPct}%</span> : "Ninguém começou"}</td>
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
                    <td>{s.company ?? "Não informada"}</td>
                    <td>{s.currentTrack ?? "Nenhuma"}</td>
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
