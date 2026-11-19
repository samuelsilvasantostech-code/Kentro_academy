/**
 * Onde o aluno parou em cada vídeo. Fica só neste navegador (localStorage), sem ir para o banco.
 * Tudo protegido por try/catch: em aba anônima ou com armazenamento bloqueado, a aula só começa do início.
 */
const KEY = (youtubeId: string) => `kentro:video:${youtubeId}`;
const listeners = new Set<() => void>();

export function readPosition(youtubeId: string): number {
  try {
    const n = Number(localStorage.getItem(KEY(youtubeId)));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Guarda a posição; perto do fim (ou bem no começo) apaga, para a próxima vez começar do zero. */
export function writePosition(youtubeId: string, seconds: number, total: number) {
  try {
    if (seconds < 10 || (total > 0 && seconds > total - 20)) localStorage.removeItem(KEY(youtubeId));
    else localStorage.setItem(KEY(youtubeId), String(Math.floor(seconds)));
  } catch {
    /* sem armazenamento: ignora */
  }
  listeners.forEach((f) => f());
}

export function subscribePosition(f: () => void) {
  listeners.add(f);
  window.addEventListener("storage", f);
  return () => {
    listeners.delete(f);
    window.removeEventListener("storage", f);
  };
}
