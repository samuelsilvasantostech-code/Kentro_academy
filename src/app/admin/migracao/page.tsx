import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminOrNotFound, migracaoDisponivel } from "@/lib/db/admin";
import { MigracaoPanel } from "./panel";

export const metadata: Metadata = { title: "Migração" };
export const dynamic = "force-dynamic";

// Tela temporária (fora do menu): só existe no Doca enquanto MIGRACAO_ORIGEM_URL estiver configurada.
export default async function MigracaoPage() {
  const admin = await getAdminOrNotFound();
  if (!migracaoDisponivel(admin)) notFound();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Migração para o Doca</h1>
          <p className="muted">Copia alunos, senhas, progresso e conteúdo do banco atual para o banco do Doca.</p>
        </div>
      </div>
      <MigracaoPanel />
    </>
  );
}
