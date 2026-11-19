import { KentroWordmark } from "./kentro-wordmark";

/** Marca da Kentro Academy: o logotipo oficial "Kentro" (balão verde no "o") com "Academy" embaixo, como no Academy original. */
export function Logo({ tag, height = 24 }: { tag?: string; height?: number }) {
  return (
    <span className="logo-lock">
      <KentroWordmark height={height} className="logo-wm" />
      <span className="logo-a">Academy{tag && <span className="adm-tag">{tag}</span>}</span>
      <span className="sr-only">Kentro Academy{tag ? ` ${tag}` : ""}</span>
    </span>
  );
}
