import type { IcoName } from "@/components/ico";
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
 * Capa de cada tipo de trilha: todas no mesmo padrão (fundo preto, cristal roxo e ícone do assunto),
 * com o nome curto do assunto e um ângulo de órbita diferente para os cards não ficarem idênticos.
 */
export const COVERS: Record<ArtId, { icon: IcoName; label: string; tilt: number }> = {
  headset: { icon: "headset", label: "Atendimento", tilt: -14 },
  painel: { icon: "chart", label: "Gestão", tilt: 10 },
  funil: { icon: "target", label: "CRM", tilt: -6 },
  engrenagem: { icon: "flow", label: "URA e automações", tilt: 16 },
  conexao: { icon: "ext", label: "Integrações", tilt: -20 },
  camadas: { icon: "layers", label: "Implantação", tilt: 4 },
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
