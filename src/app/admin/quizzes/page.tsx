import Link from "next/link";
import type { Metadata } from "next";
import { getAdminTracks } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Quizzes" };

export default async function QuizzesPage() {
  const tracks = await getAdminTracks();
  return (
    <>
      <div className="adm-head"><div><h1>Quizzes</h1><p className="muted">Um quiz por módulo. Escolha um módulo para editar as perguntas.</p></div></div>
      {tracks.map((t) => (
        <section key={t.id} className="adm-card" aria-labelledby={`q-${t.id}`}>
          <h2 id={`q-${t.id}`}>{t.icon} {t.name}</h2>
          {t.modules.length === 0 ? <p className="muted">Sem módulos.</p> : (
            <ul className="adm-list">
              {t.modules.map((m) => (
                <li key={m.id} className="adm-row sub">
                  <div className="adm-grow"><b>{m.title}</b></div>
                  <span className={`pill ${m.quizCount ? "v" : ""}`}>{m.quizCount ? `${m.quizCount} perguntas` : "Sem quiz"}</span>
                  <Link className="btn btn-s btn-sm" href={`/admin/quizzes/${m.id}`} aria-label={`Editar quiz do módulo ${m.title}`}>Editar</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
