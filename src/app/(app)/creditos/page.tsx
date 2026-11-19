import type { Metadata } from "next";
import Image from "next/image";
import { allCovers } from "@/lib/covers";

export const metadata: Metadata = { title: "Créditos das imagens" };

export default function Creditos() {
  const list = allCovers();
  return (
    <div className="kh cat">
      <header className="cat-h">
        <div>
          <p className="cat-k">Créditos</p>
          <h1>Fotos das capas</h1>
          <p className="cat-sub">As capas das trilhas e dos módulos usam fotos do Unsplash e do Pexels, com licença livre. Obrigado a quem as fotografou.</p>
        </div>
      </header>
      <ul className="credl">
        {list.map((c) => (
          <li key={c.key}>
            <span className="credl-img"><Image src={c.src} alt={c.alt} fill sizes="120px" /></span>
            <span><b>{c.credit.replace(/^Foto: /, "")}</b><span className="dim">{c.alt}</span><a href={c.page} target="_blank" rel="noopener noreferrer">Ver original</a></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
