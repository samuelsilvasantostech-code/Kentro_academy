import type { Metadata } from "next";
import { TrackForm } from "../../_components/track-form";
import { BackLink } from "../../_components/back-link";

export const metadata: Metadata = { title: "Nova trilha" };

export default function NovaTrilha() {
  return (
    <>
      <div className="adm-head"><div><BackLink href="/admin/trilhas">Trilhas</BackLink><h1>Nova trilha</h1></div></div>
      <div className="adm-card"><TrackForm /></div>
    </>
  );
}
