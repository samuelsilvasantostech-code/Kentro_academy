import Image from "next/image";
import { CrystalGlyph } from "@/components/crystal/CrystalGlyph";
import { Ico, type IcoName } from "@/components/ico";
import type { CoverImg } from "@/lib/covers";
import { KentroWordmark } from "@/components/kentro-wordmark";

/** Capa de trilha ou módulo: a foto com véu roxo escuro por cima; sem foto, o cristal da marca. */
export function Cover({ img, icon, tilt = 0, sizes, priority, brand, className = "" }: {
  img: CoverImg | null; icon: IcoName; tilt?: number; sizes: string; priority?: boolean; className?: string;
  /** Assinatura "Kentro Academy" no canto, como nos cartazes do Academy original. */
  brand?: boolean;
}) {
  return (
    <span className={`kcov ${img ? "has-img" : "no-img"} ${className}`}>
      {img ? <Image src={img.src} alt="" fill sizes={sizes} priority={priority} /> : <CrystalGlyph className="kcov-gem" tilt={tilt} />}
      {brand ? <span className="kcov-brand" aria-hidden><KentroWordmark height={16} /><b>Academy</b></span>
        : <span className="kcov-ico" aria-hidden><Ico name={icon} size={18} /></span>}
    </span>
  );
}
