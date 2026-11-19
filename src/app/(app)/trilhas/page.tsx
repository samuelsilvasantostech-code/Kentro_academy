import type { Metadata } from "next";
import { getCatalog, getMe } from "@/lib/catalog";
import { Explorer } from "@/components/explorer";
import { getTrackStatuses } from "../certificado/completion";
import { exploreData } from "../explore-data";

export const metadata: Metadata = { title: "Trilhas de aprendizagem" };

export default async function Trilhas() {
  const [{ profile, done }, tracks, statuses] = await Promise.all([getMe(), getCatalog(), getTrackStatuses()]);
  const { items, lessons } = exploreData(tracks, done, statuses, profile.role_track ?? undefined);
  return (
    <div className="kh">
      <header className="kpage-h">
        <h1>Trilhas de aprendizagem</h1>
        <p>Cada trilha é um caminho com começo, meio e certificado. As aulas são curtas e podem ser feitas em qualquer ordem.</p>
      </header>
      <Explorer tracks={items} lessons={lessons} title="Todas as trilhas" />
    </div>
  );
}
