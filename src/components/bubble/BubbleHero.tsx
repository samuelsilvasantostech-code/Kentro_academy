import { BubbleGlyph } from "./BubbleGlyph";

/** Balão da logo no herói do início: SVG com animação leve só em CSS (sem WebGL). `lit` = linhas verdes (progresso). */
export function BubbleHero({ lit }: { lit: number }) {
  return (
    <div className="kbubble" aria-hidden>
      <BubbleGlyph className="kbubble-svg" lit={lit} />
    </div>
  );
}
