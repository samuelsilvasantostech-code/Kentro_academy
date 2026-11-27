import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getMe, getQuizForStudent } from "@/lib/db/aluno";
import { Ico } from "@/components/ico";
import { QuizForm } from "./quiz-form";

export const metadata = { title: "Quiz" };

export default async function Quiz({ params }: { params: Promise<{ trilha: string; modulo: string }> }) {
  const { trilha, modulo } = await params;
  const [, tracks] = await Promise.all([getMe(), getCatalog()]);
  const t = tracks.find((x) => x.id === trilha);
  const mi = Number(modulo);
  const m = t?.modules[mi];
  if (!t || !m) notFound();

  // O gabarito não vai para o navegador: a correção é feita no servidor (submitQuiz).
  const { questions, review } = await getQuizForStudent(m.id);
  if (!questions.length) notFound();

  return (
    <div className="qz">
      <nav className="bc" aria-label="Você está em">
        <ol>
          <li><Link href={`/trilha/${t.id}`}>{t.name}</Link></li>
          <li><span aria-current="page">Quiz do módulo {mi + 1}</span></li>
        </ol>
      </nav>
      <h1>{m.title}</h1>
      <div className="meta qz-meta">
        <span><Ico name="help" size={15} />{questions.length} pergunta{questions.length > 1 ? "s" : ""}</span>
        <span><Ico name="target" size={15} />Acerte pelo menos 70% para passar</span>
      </div>
      <QuizForm moduleId={m.id} trackId={t.id} questions={questions} review={review} lessons={m.lessons.map((l) => ({ id: l.id, title: l.title, href: `/aula/${t.id}/${l.id}` }))} />
    </div>
  );
}
