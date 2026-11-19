import type { IcoName } from "@/components/ico";
import { normalize } from "@/lib/format";

/** Ícone do assunto de uma aula, a partir de palavras do título (e do módulo, como reserva). */
const RULES: [RegExp, IcoName][] = [
  [/etiqueta|\btag/, "tag"],
  [/\bura\b|fluxo|automa|gatilho|\bbot\b|chatbot/, "flow"],
  [/integra|\bapi\b|webhook/, "layers"],
  [/\bcrm\b|funil|oportunidade|venda|negocio|lead/, "target"],
  [/fila|painel|supervis|monitor|indicador|relatorio|dashboard|metrica/, "chart"],
  [/config|instal|computador|desempenho|conta|cadastr|usuario|permiss|canal|canais/, "sliders"],
  [/whatsapp|chat|convers|mensage|webchat|midia|atend/, "chat"],
];

export function topicIcon(title: string, moduleTitle = ""): IcoName {
  for (const text of [normalize(title), normalize(moduleTitle)]) {
    for (const [re, ico] of RULES) if (re.test(text)) return ico;
  }
  return "video";
}
