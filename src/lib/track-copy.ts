/**
 * Texto de venda de cada trilha (página da trilha e catálogo): uma promessa curta, um parágrafo que
 * explica o ganho concreto e três resultados. Trilha nova sem texto aqui usa o pitch do banco.
 */
export type TrackCopy = { headline: string; lead: string; gains: string[] };

const COPY: Record<string, TrackCopy> = {
  atendente: {
    headline: "Atenda com segurança desde o primeiro dia",
    lead: "Aprenda a rotina completa do atendimento no Kentro: assumir conversas, organizar a fila, responder rápido com mensagens prontas e registrar tudo no CRM. Menos cliques, menos dúvida e clientes atendidos mais rápido.",
    gains: ["Assumir e transferir conversas sem perder o histórico", "Responder em segundos com respostas rápidas", "Registrar cada cliente no CRM sem retrabalho"],
  },
  gestor: {
    headline: "Veja sua operação em tempo real e decida com dados",
    lead: "Saiba quem está atendendo, onde a fila está crescendo e quais números pedem atenção. Esta trilha mostra como acompanhar a equipe, ler os indicadores e organizar o time para atender mais e melhor.",
    gains: ["Acompanhar a equipe e as filas ao vivo", "Ler os indicadores de atendimento e agir rápido", "Organizar o time por setores e permissões"],
  },
  implantacao: {
    headline: "Deixe o Kentro pronto para a sua empresa",
    lead: "Conecte o WhatsApp, as redes sociais e o chat do seu site, e configure setores, horários e mensagens automáticas. No fim, sua conta funciona do jeito da sua operação, sem depender do suporte.",
    gains: ["Conectar todos os canais em um só lugar", "Ativar o WhatsApp API oficial", "Colocar o webchat no seu site"],
  },
  crm: {
    headline: "Transforme conversas em vendas",
    lead: "Monte um funil que reflete o seu processo comercial, acompanhe cada oportunidade sem planilha e deixe as automações moverem os negócios por você. Mais controle do pipeline e nenhum follow-up esquecido.",
    gains: ["Montar um funil de vendas do zero", "Acompanhar as oportunidades no dia a dia", "Automatizar as etapas do funil"],
  },
  automacao: {
    headline: "Construa fluxos que atendem sozinhos",
    lead: "Do primeiro bloco ao fluxo completo: crie URAs e chatbots que recebem o cliente, entendem o que ele precisa e encaminham para a pessoa certa, 24 horas por dia, sem abrir chamado no suporte.",
    gains: ["Criar fluxos de atendimento do zero", "Controlar a distribuição e os contatos", "Montar fluxos completos com notificações"],
  },
  integracoes: {
    headline: "Conecte o Kentro às ferramentas que você já usa",
    lead: "Integre o Kentro ao seu site, ERP ou sistema interno e troque dados automaticamente. Para quem cuida da parte técnica e quer o atendimento conversando com o resto da empresa.",
    gains: ["Entender as integrações disponíveis", "Usar a API do Kentro com segurança", "Automatizar a troca de dados entre sistemas"],
  },
};

export function trackCopy(t: { id: string; pitch: string; outcomes: string[] }): TrackCopy {
  const c = COPY[t.id];
  // Resultados cadastrados no admin têm prioridade sobre os do texto padrão.
  if (c) return { ...c, gains: t.outcomes.length ? t.outcomes : c.gains };
  return { headline: t.pitch, lead: t.pitch, gains: t.outcomes };
}
