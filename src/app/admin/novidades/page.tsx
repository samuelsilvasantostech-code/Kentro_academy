import Link from "next/link";
import type { Metadata } from "next";
import { getAdminNews, getAdminOrNotFound } from "@/lib/db/admin";
import { deleteNews, moveNews } from "../_actions/news";
import { ConfirmDelete } from "../_components/confirm-delete";
import { MoveButtons } from "../_components/move-buttons";
import { Ico } from "@/components/ico";

export const metadata: Metadata = { title: "Novidades" };

export default async function NovidadesPage() {
  const news = await getAdminNews(await getAdminOrNotFound());
  return (
    <>
      <div className="adm-head">
        <div><h1>Novidades</h1><p className="muted">Avisos que aparecem no Início dos alunos.</p></div>
        <Link className="btn btn-p" href="/admin/novidades/nova"><Ico name="plus" size={16} />Nova novidade</Link>
      </div>
      {news.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma novidade ainda. Crie uma para avisar os alunos no Início.</p></div>
      ) : (
        <ul className="adm-list">
          {news.map((n, i) => (
            <li key={n.id} className="adm-card">
              <div className="adm-row" style={{ border: 0, padding: 0, background: "none" }}>
                <div className="adm-grow">
                  <Link href={`/admin/novidades/${n.id}`}><b>{n.title}</b></Link>
                  <span className="adm-sub">{n.href ? n.href : "Em breve (sem link)"}</span>
                </div>
                <span className={`pill ${n.published ? "v" : "a"}`}>{n.published ? "Publicada" : "Rascunho"}</span>
                <div className="adm-acts">
                  <MoveButtons what="novidade" name={n.title} first={i === 0} last={i === news.length - 1}
                    up={moveNews.bind(null, n.id, "up")} down={moveNews.bind(null, n.id, "down")} />
                  <Link className="btn btn-s btn-sm" href={`/admin/novidades/${n.id}`}>Editar</Link>
                </div>
              </div>
              <ConfirmDelete label="Excluir novidade" title={`Excluir a novidade “${n.title}”?`} run={deleteNews.bind(null, n.id)} warning="A novidade sai do Início dos alunos." />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
