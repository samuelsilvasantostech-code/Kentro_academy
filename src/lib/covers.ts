import data from "./covers.data.json";

/**
 * Capas em foto (public/covers): "<trilha>.jpg" para a trilha e "<trilha>-<n>.jpg" para o módulo n (ordem na trilha).
 * Fotos do Unsplash/Pexels (licença livre para uso comercial); créditos em public/covers/credits-*.json.
 * covers.data.json lista os arquivos que existem, com o texto alternativo. Sem foto, a tela usa a arte do cristal.
 */
type Entry = { alt: string; credit: string; page: string };
const MAP = data as Record<string, Entry>;

export type CoverImg = { src: string; alt: string; credit: string };

export function coverOf(trackId: string, moduleIndex?: number): CoverImg | null {
  const key = moduleIndex === undefined ? trackId : `${trackId}-${moduleIndex}`;
  const e = MAP[key];
  return e ? { src: `/covers/${key}.jpg`, alt: e.alt, credit: e.credit } : null;
}

/** Todas as fotos usadas, para a página de créditos. */
export function allCovers(): (CoverImg & { key: string; page: string })[] {
  return Object.entries(MAP).map(([key, e]) => ({ key, src: `/covers/${key}.jpg`, alt: e.alt, credit: e.credit, page: e.page }));
}
