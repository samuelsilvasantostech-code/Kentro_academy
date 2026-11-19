import type { Metadata } from "next";
import { NewsForm } from "../../_components/news-form";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Nova novidade" };

export default function NovaNovidade() {
  return (
    <>
      <div className="adm-head"><div><BackLink href="/admin/novidades">Novidades</BackLink><h1>Nova novidade</h1></div></div>
      <div className="adm-card"><NewsForm /></div>
    </>
  );
}
