import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminOrNotFound, getAdminQuiz, getAdminTracks } from "@/lib/db/admin";
import { hasLearningFeatures } from "@/lib/features";
import { QuizEditor } from "../../_components/quiz-editor";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Editar quiz" };

export default async function EditarQuiz({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const admin = await getAdminOrNotFound();
  const tracks = await getAdminTracks(admin);
  const track = tracks.find((t) => t.modules.some((m) => m.id === modulo));
  const mod = track?.modules.find((m) => m.id === modulo);
  if (!track || !mod) notFound();
  const [quiz, review] = await Promise.all([getAdminQuiz(admin, mod.id), hasLearningFeatures()]);

  return (
    <>
      <div className="adm-head">
        <div>
          <BackLink href="/admin/quizzes">Quizzes</BackLink>
          <h1>Quiz: {mod.title}</h1>
          <p className="muted">Trilha {track.name}, com {quiz.length} perguntas. O aluno só vê a resposta correta depois de passar no quiz.</p>
        </div>
      </div>
      <div className="adm-card"><QuizEditor moduleId={mod.id} initial={quiz} lessons={review ? mod.lessons.map((l) => ({ id: l.id, title: l.title })) : null} /></div>
    </>
  );
}
