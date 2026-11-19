import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminLessons, getAdminTracks } from "@/lib/admin/queries";
import { formatDuration } from "@/lib/admin/validate";
import { deleteTrack } from "../../_actions/tracks";
import { deleteModule, moveModule } from "../../_actions/modules";
import { moveLessonInModule, setLessonPublished, unlinkLesson } from "../../_actions/lessons";
import { ActionButton } from "../../_components/action-button";
import { ConfirmDelete } from "../../_components/confirm-delete";
import { LinkLessonToModule } from "../../_components/link-lesson";
import { ModuleForm } from "../../_components/module-form";
import { MoveButtons } from "../../_components/move-buttons";
import { TrackForm } from "../../_components/track-form";
import { BackLink } from "../../_components/back-link";
import { Ico } from "@/components/ico";

export const metadata: Metadata = { title: "Editar trilha" };

export default async function EditarTrilha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tracks, allLessons] = await Promise.all([getAdminTracks(), getAdminLessons()]);
  const track = tracks.find((t) => t.id === id);
  if (!track) notFound();

  return (
    <>
      <div className="adm-head">
        <div><BackLink href="/admin/trilhas">Trilhas</BackLink><h1>{track.name}</h1></div>
        <Link className="btn btn-s" href={`/trilha/${track.id}`}>Ver como aluno</Link>
      </div>

      <section className="adm-card" aria-labelledby="t-dados"><h2 id="t-dados">Dados da trilha</h2><TrackForm initial={track} /></section>

      <section className="adm-card" aria-labelledby="t-mods">
        <h2 id="t-mods">Módulos e aulas</h2>
        {track.modules.length === 0 && <p className="muted">Nenhum módulo ainda. Adicione o primeiro abaixo.</p>}
        <ul className="adm-list">
          {track.modules.map((m, mi) => {
            const inModule = new Set(m.lessons.map((l) => l.id));
            const available = allLessons.filter((l) => !inModule.has(l.id)).map((l) => ({ id: l.id, title: l.title }));
            return (
              <li key={m.id} className="adm-card" style={{ background: "var(--superficie-2)" }}>
                <div className="adm-row">
                  <div className="adm-grow"><b>{mi + 1}. {m.title}</b><span className="adm-sub">{m.lessons.length} aulas, {m.quizCount} perguntas no quiz</span></div>
                  <div className="adm-acts">
                    <MoveButtons what="módulo" name={m.title} first={mi === 0} last={mi === track.modules.length - 1}
                      up={moveModule.bind(null, m.id, "up")} down={moveModule.bind(null, m.id, "down")} />
                    <Link className="btn btn-s btn-sm" href={`/admin/quizzes/${m.id}`}>Quiz</Link>
                  </div>
                </div>
                <ModuleForm module={{ id: m.id, title: m.title }} />

                {m.lessons.length === 0 ? <p className="adm-sub">Sem aulas neste módulo.</p> : (
                  <ul className="adm-list">
                    {m.lessons.map((l, li) => (
                      <li key={l.id} className="adm-row sub">
                        <div className="adm-grow">
                          <Link href={`/admin/aulas/${l.id}`}><b>{l.title}</b></Link>
                          <span className="adm-sub">{l.duration_seconds ? formatDuration(l.duration_seconds) : "sem vídeo"}</span>
                        </div>
                        <span className={`pill ${l.published ? "v" : "a"}`}>{l.published ? "Publicada" : "Rascunho"}</span>
                        <div className="adm-acts">
                          <MoveButtons what="aula" name={l.title} first={li === 0} last={li === m.lessons.length - 1}
                            up={moveLessonInModule.bind(null, m.id, l.id, "up")} down={moveLessonInModule.bind(null, m.id, l.id, "down")} />
                          <ActionButton run={setLessonPublished.bind(null, l.id, !l.published)}>{l.published ? "Despublicar" : "Publicar"}</ActionButton>
                          <ActionButton run={unlinkLesson.bind(null, l.id, m.id)} label={`Desvincular ${l.title} deste módulo`}>Desvincular</ActionButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="adm-btns"><Link className="btn btn-s btn-sm" href={`/admin/aulas/nova?modulo=${m.id}`}><Ico name="plus" size={16} />Nova aula neste módulo</Link></div>
                <LinkLessonToModule moduleId={m.id} lessons={available} />
                <ConfirmDelete
                  label="Excluir módulo" title={`Excluir o módulo "${m.title}"?`} run={deleteModule.bind(null, m.id)}
                  warning="Apaga as perguntas do quiz e as tentativas dos alunos neste módulo. As aulas continuam existindo, só perdem o vínculo."
                />
              </li>
            );
          })}
        </ul>
        <ModuleForm trackId={track.id} />
      </section>

      <section className="adm-card" aria-labelledby="t-del">
        <h2 id="t-del">Excluir trilha</h2>
        <ConfirmDelete
          label="Excluir trilha" title={`Excluir a trilha "${track.name}"?`} run={deleteTrack.bind(null, track.id)} redirectTo="/admin/trilhas"
          warning="Apaga a trilha, os módulos, os quizzes e as tentativas. As aulas continuam existindo, mas ficam sem módulo."
        />
      </section>
    </>
  );
}
