import Link from "next/link";
import type { Lesson } from "@/lib/catalog";
import { duration } from "@/lib/format";
import { Ico } from "@/components/ico";
import { topicIcon } from "@/lib/topic";

/* ---------- linhas do estilo minimalista (listas) ---------- */

export const Chev = () => (
  <svg className="ml-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
);

/** Aula em uma linha: marcador de concluída, título, trilha/módulo, duração e seta. */
export function LessonRow({ lesson, trackId, meta, done, extra }: { lesson: Lesson; trackId: string; meta: string[]; done?: boolean; extra?: React.ReactNode }) {
  return (
    <li>
      <Link href={`/aula/${trackId}/${lesson.id}`}>
        <span className={`ml-ico${done ? " on" : ""}`} aria-hidden>
          <Ico name={done ? "check" : topicIcon(lesson.title, meta[meta.length - 1])} size={16} strokeWidth={done ? 3 : 2} />
        </span>
        <span className="ml-main">
          <b>{lesson.title}{done && <span className="sr-only"> (concluída)</span>}</b>
          <span className="mmeta">{meta.filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}</span>
          {extra}
        </span>
        <span className="ml-time">{lesson.duration_seconds ? duration(lesson.duration_seconds) : "Leitura"}</span>
        <Chev />
      </Link>
    </li>
  );
}
