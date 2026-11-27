import type { Metadata } from "next";
import { progress } from "@/lib/catalog";
import { getCatalog, getMe } from "@/lib/db/aluno";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Começar" };

// Papéis do onboarding → trilha recomendada (vêm do protótipo). O ícone de cada papel é escolhido no cliente, pela chave `k`.
const ROLES = [
  { k: "atendente", t: "Atendo clientes", s: "Converso com clientes pelo WhatsApp, Instagram ou webchat" },
  { k: "gestor", t: "Lidero uma equipe", s: "Acompanho os atendentes e os resultados" },
  { k: "implantacao", t: "Configuro o Kentro", s: "Sou responsável por conectar canais e deixar tudo funcionando" },
  { k: "automacao", t: "Crio automações", s: "Quero montar fluxos, URAs e integrações" },
];

export default async function Comecar() {
  const [{ done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const plans = Object.fromEntries(tracks.map((t) => {
    const p = progress(t, done);
    return [t.id, { name: t.name, color: t.color, outcomes: t.outcomes, total: p.count, seconds: p.seconds }];
  }));
  return <Onboarding roles={ROLES.filter((r) => plans[r.k])} plans={plans} />;
}
