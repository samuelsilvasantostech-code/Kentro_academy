import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import "./tema-kentro.css"; // tema claro alternativo: ./claro.css

// Tipografia da marca: Sora nos títulos (geométrica, cara de produto de tecnologia),
// Geist no texto corrido (legível em telas pequenas) e Geist Mono em rótulos, números e códigos.
const display = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] });
const body = Geist({ subsets: ["latin"], variable: "--font-body" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Kentro Academy", template: "%s · Kentro Academy" },
  description: "Aprenda a usar o Kentro com trilhas curtas, do primeiro atendimento às automações.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
