"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** false enquanto a aba está oculta: usado para parar o loop de render. */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/** Ponteiro normalizado (-1..1) na janela inteira, em ref (não causa render). */
export function usePointerRef() {
  const p = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      p.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return p;
}

/**
 * Câmera que enquadra um retângulo (w x h em unidades do mundo) e faz parallax leve com o mouse.
 * Não gira sozinha: só segue o ponteiro, amortecida. Com `still` (prefers-reduced-motion) não há parallax
 * nem amortecimento: cada frame (poucos, no modo "demand") já enquadra direto.
 */
export function FitCamera({ width, height, sway = 0.5, margin = 1.08, still = false }: { width: number; height: number; sway?: number; margin?: number; still?: boolean }) {
  const pointer = usePointerRef();
  const started = useRef(false);
  useFrame(({ camera, size }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / Math.max(size.height, 1);
    const z = Math.max(height / (2 * t), width / (2 * t * aspect)) * margin;
    const k = still || !started.current ? 1 : 1 - Math.exp(-4 * dt);
    started.current = true;
    cam.position.x += ((still ? 0 : pointer.current.x * sway) - cam.position.x) * k;
    cam.position.y += ((still ? 0 : pointer.current.y * sway * 0.6) - cam.position.y) * k;
    cam.position.z += (z - cam.position.z) * k;
    cam.lookAt(0, 0, 0);
  });
  return null;
}
