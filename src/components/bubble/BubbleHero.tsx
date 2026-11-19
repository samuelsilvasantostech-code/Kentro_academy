"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { BubbleGlyph } from "./BubbleGlyph";
import { Lazy3D, type SceneProps } from "@/components/crystal/Lazy3D";

const BubbleScene3D = dynamic(() => import("./BubbleScene3D"), { ssr: false });

/** Balão da logo no herói do início: SVG no servidor, 3D animado carregado depois (ver Lazy3D). `lit`: linhas verdes (0 a 3). */
export function BubbleHero({ lit }: { lit: number }) {
  // Componente estável: recriar a cada render remontaria o Canvas.
  const Scene = useMemo(() => {
    const S = (p: SceneProps) => <BubbleScene3D {...p} lit={lit} />;
    return S;
  }, [lit]);
  return <Lazy3D base="kbubble" fallback={<BubbleGlyph className="kbubble-svg" lit={lit} />} Scene={Scene} />;
}
