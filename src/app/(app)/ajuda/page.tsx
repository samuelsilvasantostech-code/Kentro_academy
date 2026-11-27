import type { Metadata } from "next";
import Link from "next/link";
import { Ico, type IcoName } from "@/components/ico";

export const metadata: Metadata = { title: "Ajuda" };

const FAQ: { icon: IcoName; q: string; a: React.ReactNode }[] = [
  {
    icon: "target",
    q: "Por onde devo começar?",
    a: <>Pela trilha recomendada para a sua função, que aparece em <Link href="/">Início</Link>. Se a sua função mudou, abra o menu da conta (o círculo com as suas iniciais, no topo) e escolha “Trocar minha trilha”.</>,
  },
  {
    icon: "refresh",
    q: "Meu progresso fica salvo?",
    a: <>Sim. Ao terminar uma aula, use “Concluir e avançar” abaixo do vídeo. A plataforma lembra a última aula aberta, e o botão “Continuar aula” no Início leva direto para ela.</>,
  },
  {
    icon: "award",
    q: "Como ganho o certificado?",
    a: <>Conclua todas as aulas com vídeo da trilha e passe nos quizzes dos módulos, com pelo menos 70% de acertos. Aulas só de leitura não contam. Os certificados ficam em <Link href="/meu">Meu progresso</Link>.</>,
  },
  {
    icon: "chat",
    q: "Tenho uma dúvida sobre uma aula. Onde envio?",
    a: <>Na própria aula, na aba “Dúvidas”. A equipe responde em até 2 dias úteis, e a resposta aparece na aula e também no Início.</>,
  },
  {
    icon: "search",
    q: "Como encontro uma aula específica?",
    a: <>Use a <Link href="/buscar">busca</Link> com uma palavra do assunto, como “etiqueta” ou “fila”. A busca procura no título, no resumo e no texto das aulas.</>,
  },
  {
    icon: "lock",
    q: "Esqueci minha senha. E agora?",
    a: <>Saia da conta e, na tela Entrar, clique em “Esqueci a senha”. Você recebe um link por e-mail para criar uma nova senha.</>,
  },
];

export default function Ajuda() {
  return (
    <div className="kh kh-narrow">
      <header className="kpage-h">
        <h1>Ajuda</h1>
        <p>Respostas rápidas sobre trilhas, progresso e certificados.</p>
      </header>
      <div className="faq">
        {FAQ.map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary><span className="faq-ico" aria-hidden><Ico name={f.icon} size={18} /></span>{f.q}<Ico name="down" size={16} className="faq-chev" /></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
