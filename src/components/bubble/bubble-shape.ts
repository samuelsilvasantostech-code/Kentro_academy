/**
 * Geometria do balão do "o" da logo Kentro, medida no logotipo oficial (círculo + rabicho embaixo à esquerda,
 * miolo vazado e três linhas de mensagem). Unidade = raio externo. Y para cima.
 * Serve ao 3D (THREE.Shape) e à versão SVG estática, para as duas ficarem idênticas.
 */
export const B = {
  /** Ângulos (graus) onde o rabicho sai do círculo e a ponta dele. */
  tailFrom: 242,
  tailTo: 218.8,
  tip: [-0.85, -1.03] as const,
  /** Raio do miolo vazado. */
  inner: 0.71,
  /** Linhas: centro x, meia largura, meia altura e o y de cada uma (de cima para baixo). */
  line: { cx: -0.02, hw: 0.37, hh: 0.08, ys: [0.31, 0.005, -0.3] },
};

const rad = (d: number) => (d * Math.PI) / 180;

/** Caminho SVG do balão (viewBox -1.1 -1.1 2.2 2.2, y para baixo), com miolo e linhas vazados por evenodd. */
export function bubbleSvgPath(): string {
  const p = (a: number, r = 1) => `${(Math.cos(rad(a)) * r).toFixed(4)} ${(-Math.sin(rad(a)) * r).toFixed(4)}`;
  const outer = `M${p(B.tailFrom)} A1 1 0 1 0 ${p(B.tailTo)} L${B.tip[0]} ${-B.tip[1]} Z`;
  const r = B.inner;
  const hole = `M${r} 0 A${r} ${r} 0 1 0 ${-r} 0 A${r} ${r} 0 1 0 ${r} 0 Z`;
  return `${outer} ${hole}`;
}

/** Linhas do balão como retângulos arredondados para o SVG. */
export function bubbleSvgLines() {
  const { cx, hw, hh, ys } = B.line;
  return ys.map((y) => ({ x: cx - hw, y: -y - hh, w: hw * 2, h: hh * 2, r: hh }));
}
