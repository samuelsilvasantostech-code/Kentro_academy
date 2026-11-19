import Link from "next/link";
import type { Metadata } from "next";
import { getAdminLessons, getQuestions } from "@/lib/admin/queries";
import { AnswerForm } from "../_components/answer-form";

export const metadata: Metadata = { title: "Dúvidas" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function DuvidasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const answered = filtro === "respondidas";
  const [list, lessons] = await Promise.all([getQuestions(answered ? "answered" : "pending"), getAdminLessons()]);
  const studentLink = new Map(lessons.map((l) => [l.id, l.links[0] ? `/aula/${l.links[0].trackId}/${l.id}` : null]));

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Dúvidas</h1>
          <p className="muted">{answered ? "Respondidas mais recentes primeiro." : "Fila sem resposta, da mais antiga para a mais nova."}</p>
        </div>
        <nav className="adm-seg" aria-label="Filtro">
          <Link href="/admin/duvidas" aria-current={answered ? undefined : "page"}>Pendentes</Link>
          <Link href="/admin/duvidas?filtro=respondidas" aria-current={answered ? "page" : undefined}>Respondidas</Link>
        </nav>
      </div>

      {list.length === 0 ? (
        <div className="adm-empty"><p>{answered ? "Nenhuma dúvida respondida ainda." : "Tudo respondido. Nenhuma dúvida na fila."}</p></div>
      ) : (
        <ul className="adm-list">
          {list.map((q) => {
            const href = studentLink.get(q.lesson.id);
            return (
              <li key={q.id} className="adm-card">
                <div className="adm-qmeta">
                  <b>{q.student.full_name}</b>
                  {q.student.company && <span className="adm-sub">{q.student.company}</span>}
                  <span className="adm-sub">Enviada em {fmt.format(new Date(q.created_at))}</span>
                  <span className="adm-sub">
                    Aula:{" "}
                    {href ? <Link href={href} className="adm-lnk">{q.lesson.title}</Link> : q.lesson.title}
                  </span>
                </div>
                <p className="adm-quote">{q.body}</p>
                <AnswerForm id={q.id} answer={q.answer} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
