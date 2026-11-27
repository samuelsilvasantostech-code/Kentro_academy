import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminLesson, getAdminOrNotFound, getAdminTracks } from "@/lib/db/admin";
import { hasLearningFeatures, hasLessonTexts, hasTranscripts } from "@/lib/features";
import { deleteLesson, setLessonPublished, unlinkLesson } from "../../_actions/lessons";
import { ActionButton } from "../../_components/action-button";
import { ConfirmDelete } from "../../_components/confirm-delete";
import { LessonForm } from "../../_components/lesson-form";
import { LinkToAnotherModule } from "../../_components/link-lesson";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Editar aula" };

export default async function EditarAula({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  const { id } = await params;
  const { nova } = await searchParams;
  const admin = await getAdminOrNotFound();
  const lesson = await getAdminLesson(admin, id);
  if (!lesson) notFound();
  const [tracks, kp, lt, tr] = await Promise.all([getAdminTracks(admin), hasLearningFeatures(), hasLessonTexts(), hasTranscripts()]);

  return (
    <>
      <div className="adm-head">
        <div>
          <BackLink href="/admin/aulas">Aulas</BackLink>
          <h1>{lesson.title}</h1>
        </div>
        <span className={`pill ${lesson.published ? "v" : "a"}`}>{lesson.published ? "Publicada" : "Rascunho"}</span>
      </div>

      {nova && !lesson.published && <p className="ok-msg" role="status">Aula salva como rascunho. Quando estiver pronta, clique em Publicar.</p>}

      <section className="adm-card" aria-labelledby="a-pub">
        <h2 id="a-pub">Publicação</h2>
        <p className="muted">{lesson.published ? "Os alunos já veem esta aula." : "Rascunho: os alunos ainda não veem esta aula."}</p>
        <div className="adm-btns">
          <ActionButton className={`btn ${lesson.published ? "btn-s" : "btn-p"}`} run={setLessonPublished.bind(null, lesson.id, !lesson.published)}>
            {lesson.published ? "Voltar para rascunho" : "Publicar"}
          </ActionButton>
        </div>
      </section>

      <LessonForm key={lesson.id} initial={lesson} keyPoints={kp} lessonText={lt} transcript={tr} />

      <section className="adm-card" aria-labelledby="a-mods">
        <h2 id="a-mods">Módulos em que a aula aparece</h2>
        {lesson.links.length === 0 ? <p className="muted">Sem módulo: nenhum aluno encontra esta aula.</p> : (
          <ul className="adm-list">
            {lesson.links.map((k) => (
              <li key={k.moduleId} className="adm-row sub">
                <div className="adm-grow"><b>{k.trackName}</b><span className="adm-sub">{k.moduleTitle}</span></div>
                <ActionButton run={unlinkLesson.bind(null, lesson.id, k.moduleId)} label={`Desvincular do módulo ${k.moduleTitle}`}>Desvincular do módulo</ActionButton>
              </li>
            ))}
          </ul>
        )}
        <LinkToAnotherModule lessonId={lesson.id} tracks={tracks.map((t) => ({ id: t.id, name: t.name, modules: t.modules.map((m) => ({ id: m.id, title: m.title })) }))} />
      </section>

      <section className="adm-card" aria-labelledby="a-del">
        <h2 id="a-del">Excluir aula</h2>
        <ConfirmDelete
          label="Excluir aula" title={`Excluir a aula “${lesson.title}”?`} run={deleteLesson.bind(null, lesson.id)} redirectTo="/admin/aulas"
          warning="Exclui a aula de todas as trilhas, junto com o progresso, as anotações e as dúvidas dos alunos nela. Para só tirar a aula de um módulo, use Desvincular do módulo."
          alternative={lesson.links.length > 0 && (
            <div className="adm-list">
              <span className="adm-sub">Alternativa mais segura:</span>
              {lesson.links.map((k) => (
                <div key={k.moduleId} className="adm-btns">
                  <ActionButton run={unlinkLesson.bind(null, lesson.id, k.moduleId)} label={`Desvincular do módulo ${k.moduleTitle}`}>
                    Desvincular do módulo
                  </ActionButton>
                  <span className="adm-sub">{k.trackName}, {k.moduleTitle}</span>
                </div>
              ))}
            </div>
          )}
        />
      </section>
    </>
  );
}
