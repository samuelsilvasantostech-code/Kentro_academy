import type { Metadata } from "next";
import { getAdminTracks } from "@/lib/admin/queries";
import { LessonForm } from "../../_components/lesson-form";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Nova aula" };

export default async function NovaAula({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const { modulo } = await searchParams;
  const tracks = await getAdminTracks();
  return (
    <>
      <div className="adm-head">
        <div>
          <BackLink href="/admin/aulas">Aulas</BackLink>
          <h1>Nova aula</h1>
          <p className="muted">Ela nasce como rascunho. Você publica depois de conferir.</p>
        </div>
      </div>
      <LessonForm tracks={tracks} presetModule={modulo} />
    </>
  );
}
