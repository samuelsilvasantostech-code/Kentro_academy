import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminQuiz, getAdminTracks } from "@/lib/admin/queries";
import { QuizEditor } from "../../_components/quiz-editor";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Editar quiz" };

export default async function EditarQuiz({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const tracks = await getAdminTracks();
  const track = tracks.find((t) => t.modules.some((m) => m.id === modulo));
  const mod = track?.modules.find((m) => m.id === modulo);
  if (!track || !mod) notFound();
  const quiz = await getAdminQuiz(mod.id);

  return (
    <>
      <div className="adm-head">
        <div>
          <BackLink href="/admin/quizzes">Quizzes</BackLink>
          <h1>Quiz: {mod.title}</h1>
          <p className="muted">Trilha {track.name}, com {quiz.length} perguntas. O gabarito só aparece aqui, nunca para o aluno.</p>
        </div>
      </div>
      <div className="adm-card"><QuizEditor moduleId={mod.id} initial={quiz} /></div>
    </>
  );
}
