import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import "./tema-kentro.css"; // tema claro alternativo: ./claro.css

// Títulos: largura variável (wdth) usada de verdade via font-stretch no CSS.
// Sem o eixo opsz (tamanho óptico): o arquivo cai bastante e a diferença visual nos títulos é mínima.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", axes: ["wdth"] });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "Kentro Academy", template: "%s · Kentro Academy" },
  description: "Aprenda a usar o Kentro com trilhas curtas, do primeiro atendimento às automações.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
