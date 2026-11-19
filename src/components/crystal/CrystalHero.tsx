"use client";

import dynamic from "next/dynamic";
import { CrystalGlyph } from "./CrystalGlyph";
import { Lazy3D } from "./Lazy3D";

const CrystalScene3D = dynamic(() => import("./CrystalScene3D"), { ssr: false });

/** Cristal do topo do início: SVG no servidor, 3D carregado depois (ver Lazy3D). */
export function CrystalHero() {
  return <Lazy3D base="kcrystal" fallback={<CrystalGlyph className="kcrystal-svg" />} Scene={CrystalScene3D} />;
}
