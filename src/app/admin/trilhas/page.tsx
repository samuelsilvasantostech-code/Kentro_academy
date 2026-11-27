import Link from "next/link";
import type { Metadata } from "next";
import { getAdminOrNotFound, getAdminTracks } from "@/lib/db/admin";
import { moveTrack } from "../_actions/tracks";
import { MoveButtons } from "../_components/move-buttons";
import { Ico } from "@/components/ico";

export const metadata: Metadata = { title: "Trilhas" };

export default async function TrilhasPage() {
  const tracks = await getAdminTracks(await getAdminOrNotFound());
  return (
    <>
      <div className="adm-head">
        <div><h1>Trilhas</h1><p className="muted">Ordem, módulos e aulas de cada trilha.</p></div>
        <Link className="btn btn-p" href="/admin/trilhas/nova"><Ico name="plus" size={16} />Nova trilha</Link>
      </div>
      {tracks.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma trilha ainda.</p><Link className="btn btn-p" href="/admin/trilhas/nova">Criar a primeira trilha</Link></div>
      ) : (
        <ul className="adm-list">
          {tracks.map((t, i) => {
            const lessons = t.modules.reduce((n, m) => n + m.lessons.length, 0);
            return (
              <li key={t.id} className="adm-row">
                <span className="tico" style={{ background: `${t.color}22`, width: 44, height: 44, flex: "none" }} aria-hidden>{t.icon}</span>
                <div className="adm-grow">
                  <Link href={`/admin/trilhas/${t.id}`}><b>{t.name}</b></Link>
                  <span className="adm-sub">{t.modules.length} módulos e {lessons} aulas</span>
                </div>
                <span className={`pill ${t.published ? "v" : "a"}`}>{t.published ? "Publicada" : "Rascunho"}</span>
                <div className="adm-acts">
                  <MoveButtons what="trilha" name={t.name} first={i === 0} last={i === tracks.length - 1}
                    up={moveTrack.bind(null, t.id, "up")} down={moveTrack.bind(null, t.id, "down")} />
                  <Link className="btn btn-s btn-sm" href={`/admin/trilhas/${t.id}`}>Editar</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
