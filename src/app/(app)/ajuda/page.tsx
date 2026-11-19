import type { Metadata } from "next";
import Link from "next/link";
import { Ico, type IcoName } from "@/components/ico";

export const metadata: Metadata = { title: "Ajuda" };

const FAQ: { icon: IcoName; q: string; a: React.ReactNode }[] = [
  {
    icon: "target",
    q: "Por onde devo começar?",
    a: <>Pela trilha recomendada para a sua função, que aparece em <Link href="/">Início</Link>. Se a sua função mudou, abra o menu da conta e escolha “Trocar minha trilha”.</>,
  },
  {
    icon: "refresh",
    q: "Meu progresso fica salvo?",
    a: <>Sim. Ao terminar uma aula, use “Concluir e avançar” abaixo do vídeo. A plataforma lembra a última aula aberta, e o botão “Continuar aula” na página inicial leva direto para ela.</>,
  },
  {
    icon: "award",
    q: "Como ganho o certificado?",
    a: <>Conclua todas as aulas com vídeo da trilha e passe nos quizzes dos módulos, com pelo menos 70% de acertos. Aulas só de leitura não contam. Os certificados ficam em <Link href="/meu">Meus cursos</Link>.</>,
  },
  {
    icon: "chat",
    q: "Tenho uma dúvida sobre uma aula. Onde pergunto?",
    a: <>Na própria aula, na aba “Dúvidas”. Quando a equipe responder, a resposta aparece na aula e também na página inicial.</>,
  },
  {
    icon: "search",
    q: "Como encontro uma aula específica?",
    a: <>Use a <Link href="/buscar">busca</Link> com uma palavra do assunto, como “etiqueta” ou “fila”. Na página inicial, os filtros mostram só as trilhas de um assunto.</>,
  },
  {
    icon: "lock",
    q: "Esqueci minha senha.",
    a: <>Saia da conta e, na tela de entrada, use “Esqueci a senha”. Você recebe um link por e-mail para criar uma nova.</>,
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
