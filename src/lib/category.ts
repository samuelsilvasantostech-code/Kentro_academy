import { normalize } from "@/lib/format";

/**
 * Categoria de cada trilha, deduzida do nome e do público (o banco não tem campo de categoria).
 * Usada nos filtros da página inicial e de /trilhas e no desenho 3D do card.
 * A ordem importa: "Automação de atendimento" é automação, não atendimento.
 */
export type CatId = "atendimento" | "crm" | "automacoes" | "integracoes" | "implantacao";
export type ArtId = "headset" | "painel" | "funil" | "engrenagem" | "conexao" | "camadas";

export const CATS: { id: CatId; label: string }[] = [
  { id: "atendimento", label: "Atendimento" },
  { id: "crm", label: "CRM" },
  { id: "automacoes", label: "Automações" },
  { id: "integracoes", label: "Integrações" },
  { id: "implantacao", label: "Implantação" },
];

/**
 * Capa de cada tipo de trilha (estilo dos módulos da Academy antiga): foto em public/capas e nome curto do selo.
 * Fotos do Unsplash (licença livre, sem crédito obrigatório); origem em public/capas/CREDITOS.md.
 */
export const COVERS: Record<ArtId, { src: string; label: string }> = {
  headset: { src: "/capas/headset.webp", label: "Atendimento" },
  painel: { src: "/capas/painel.webp", label: "Gestão" },
  funil: { src: "/capas/funil.webp", label: "CRM" },
  engrenagem: { src: "/capas/engrenagem.webp", label: "URA e automações" },
  conexao: { src: "/capas/conexao.webp", label: "Integrações" },
  camadas: { src: "/capas/camadas.webp", label: "Implantação" },
};

const RULES: [RegExp, CatId, ArtId][] = [
  [/automa|\bura\b|fluxo|bot/, "automacoes", "engrenagem"],
  [/integra|\bapi\b|webhook|tecnic/, "integracoes", "conexao"],
  [/\bcrm\b|venda|comercial|funil/, "crm", "funil"],
  [/gest|supervis|opera/, "atendimento", "painel"],
  [/atend|agente|chat/, "atendimento", "headset"],
  [/implanta|config|admin/, "implantacao", "camadas"],
];

export function trackKind(t: { name: string; audience: string }): { cat: CatId; art: ArtId } {
  const name = normalize(t.name);
  const all = `${name} ${normalize(t.audience)}`;
  // O nome decide primeiro; o público só desempata.
  for (const text of [name, all]) for (const [re, cat, art] of RULES) if (re.test(text)) return { cat, art };
  return { cat: "implantacao", art: "camadas" };
}
