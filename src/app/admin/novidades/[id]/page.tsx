import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminNews, getAdminOrNotFound } from "@/lib/db/admin";
import { NewsForm } from "../../_components/news-form";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Editar novidade" };

export default async function EditarNovidade({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = (await getAdminNews(await getAdminOrNotFound())).find((n) => n.id === id);
  if (!item) notFound();
  return (
    <>
      <div className="adm-head"><div><BackLink href="/admin/novidades">Novidades</BackLink><h1>Editar novidade</h1></div></div>
      <div className="adm-card"><NewsForm initial={item} /></div>
    </>
  );
}
