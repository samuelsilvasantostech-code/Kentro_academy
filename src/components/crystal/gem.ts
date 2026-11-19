import * as THREE from "three";

/**
 * Gema low-poly: coroa (cone baixo truncado) + pavilhão (cone longo), 8 lados, sombreamento facetado.
 * Gerada por código: nenhum arquivo de modelo para baixar.
 */
export function gemGeometry() {
  const sides = 8;
  const crown = new THREE.CylinderGeometry(0.62, 1, 0.42, sides, 1);
  crown.translate(0, 0.21, 0);
  const pav = new THREE.ConeGeometry(1, 1.55, sides, 1);
  pav.rotateX(Math.PI);
  pav.translate(0, -0.775, 0);
  const g = new THREE.BufferGeometry();
  const a = crown.toNonIndexed(), b = pav.toNonIndexed();
  const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  crown.dispose(); pav.dispose(); a.dispose(); b.dispose();
  return g;
}
