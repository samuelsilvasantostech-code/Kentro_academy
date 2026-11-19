/* eslint-disable @next/next/no-img-element -- miniatura externa do YouTube */
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminLessons, getAdminTracks } from "@/lib/admin/queries";
import { formatDuration } from "@/lib/admin/validate";
import { Ico } from "@/components/ico";

export const metadata: Metadata = { title: "Aulas" };

export default async function AulasPage({ searchParams }: { searchParams: Promise<{ trilha?: string; q?: string }> }) {
  const { trilha = "", q = "" } = await searchParams;
  const [lessons, tracks] = await Promise.all([getAdminLessons(), getAdminTracks()]);
  const term = q.trim().toLowerCase();
  const shown = lessons.filter((l) => {
    if (trilha === "sem-modulo" ? l.links.length > 0 : trilha && !l.links.some((k) => k.trackId === trilha)) return false;
    return !term || l.title.toLowerCase().includes(term);
  });

  return (
    <>
      <div className="adm-head">
        <div><h1>Aulas</h1><p className="muted">{lessons.length} aulas no total, com rascunhos.</p></div>
        <Link className="btn btn-p" href="/admin/aulas/nova"><Ico name="plus" size={16} />Nova aula</Link>
      </div>

      <form className="adm-filter" action="/admin/aulas" role="search" aria-label="Filtrar aulas">
        <div className="adm-field">
          <label htmlFor="f-q">Buscar pelo título</label>
          <input id="f-q" className="input" name="q" defaultValue={q} placeholder="Ex.: etiquetas" />
        </div>
        <div className="adm-field">
          <label htmlFor="f-t">Trilha</label>
          <select id="f-t" className="input" name="trilha" defaultValue={trilha}>
            <option value="">Todas</option>
            <option value="sem-modulo">Sem módulo</option>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button className="btn btn-s">Filtrar</button>
        {(q || trilha) && <Link className="btn btn-s" href="/admin/aulas">Limpar</Link>}
      </form>

      {shown.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma aula encontrada.</p></div>
      ) : (
        <ul className="adm-list" aria-label="Lista de aulas">
          {shown.map((l) => (
            <li key={l.id} className="adm-row">
              {l.youtube_id ? (
                <img className="adm-thumb" loading="lazy" alt="" src={`https://i.ytimg.com/vi/${l.youtube_id}/mqdefault.jpg`} />
              ) : (
                <div className="adm-thumb adm-nothumb">sem vídeo</div>
              )}
              <div className="adm-grow">
                <Link href={`/admin/aulas/${l.id}`}><b>{l.title}</b></Link>
                {l.duration_seconds ? <span className="adm-sub">Duração {formatDuration(l.duration_seconds)}</span> : null}
                {l.links.length === 0 ? <span className="adm-sub">Sem módulo</span> : l.links.map((k) => <span key={k.moduleId} className="adm-sub">{k.trackName}, {k.moduleTitle}</span>)}
              </div>
              <span className={`pill ${l.published ? "v" : "a"}`}>{l.published ? "Publicada" : "Rascunho"}</span>
              <div className="adm-acts"><Link className="btn btn-s btn-sm" href={`/admin/aulas/${l.id}`}>Editar</Link></div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
