"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePointerRef } from "@/components/flow/scene-utils";
import { gemGeometry } from "./gem";
import type { SceneProps } from "./Lazy3D";

const STUDS = 24;

/** Medalha: disco com borda alta e chanfro (torno de um perfil), de frente para a câmera. */
function coinGeometry() {
  const p = [
    [0, 0.11], [0.74, 0.11], [0.8, 0.17], [0.97, 0.17], [1.05, 0.09],
    [1.05, -0.09], [0.97, -0.17], [0, -0.17],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(p, 72);
  g.rotateX(Math.PI / 2);
  return g;
}

function Seal({ active }: { active: boolean }) {
  const root = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const born = useRef(0);
  const pointer = usePointerRef();
  const coin = useMemo(() => coinGeometry(), []);
  const geo = useMemo(() => gemGeometry(), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo]);
  const studs = useMemo(() => Array.from({ length: STUDS }, (_, i) => {
    const a = (i / STUDS) * Math.PI * 2;
    return [Math.cos(a) * 0.885, Math.sin(a) * 0.885, 0.18] as [number, number, number];
  }), []);

  useFrame(({ clock }, dt) => {
    if (!active) return;
    const d = Math.min(dt, 0.05);
    born.current = Math.min(1, born.current + d / 0.9);
    // entrada: a medalha cresce e gira até parar de frente (uma vez)
    const e = 1 - (1 - born.current) ** 3;
    if (root.current) {
      const k = 1 - Math.exp(-3 * d);
      const sway = Math.sin(clock.elapsedTime * 0.55) * 0.28;
      root.current.scale.setScalar(0.72 + 0.28 * e);
      root.current.rotation.y += (sway + pointer.current.x * 0.3 + (1 - e) * Math.PI * 1.2 - root.current.rotation.y) * (born.current < 1 ? 1 : k);
      root.current.rotation.x += (-pointer.current.y * 0.18 - root.current.rotation.x) * k;
      root.current.position.y = Math.sin(clock.elapsedTime / 1.7) * 0.05;
    }
    if (gem.current) gem.current.rotation.y += d * 0.6;
    if (moon.current) {
      const t = clock.elapsedTime / 2.4;
      moon.current.position.set(Math.cos(t) * 1.32, 0, Math.sin(t) * 1.32);
    }
  });

  return (
    <group ref={root}>
      <mesh geometry={coin}>
        <meshPhysicalMaterial color="#7A10F0" emissive="#3A0A88" emissiveIntensity={0.5} metalness={0.55} roughness={0.3} clearcoat={1} clearcoatRoughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.115]}>
        <torusGeometry args={[0.66, 0.008, 6, 120]} />
        <meshBasicMaterial color="#E2CCFF" transparent opacity={0.55} />
      </mesh>
      {studs.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.028, 10, 8]} />
          <meshBasicMaterial color="#E2CCFF" transparent opacity={0.8} />
        </mesh>
      ))}
      <group position={[0, 0, 0.42]}>
        <group ref={gem} scale={0.36} position={[0, 0.2, 0]} rotation={[0.12, 0.4, 0]}>
          <mesh geometry={geo}>
            <meshPhysicalMaterial color="#B98AFF" emissive="#6A00E0" emissiveIntensity={0.55} roughness={0.25} metalness={0.1} clearcoat={1} flatShading />
          </mesh>
          <lineSegments geometry={edges}>
            <lineBasicMaterial color="#F5F3FF" transparent opacity={0.5} />
          </lineSegments>
        </group>
      </group>
      <group rotation={[1.25, 0.2, -0.3]}>
        <mesh>
          <torusGeometry args={[1.32, 0.007, 6, 160]} />
          <meshBasicMaterial color="#C9A8FF" transparent opacity={0.5} />
        </mesh>
        <mesh ref={moon}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color="#F5F3FF" />
        </mesh>
      </group>
    </group>
  );
}

/** Selo 3D do certificado (fundo transparente). `active` false congela o loop. */
export default function SealScene3D({ active, onReady }: SceneProps) {
  return (
    <Canvas
      aria-hidden
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ fov: 30, position: [0, 0, 7], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[-3, 4, 5]} intensity={2.4} color="#FFFFFF" />
      <pointLight position={[3, -1, 3]} intensity={18} color="#B98AFF" />
      <pointLight position={[-3, -2, -2]} intensity={14} color="#8000FF" />
      <Seal active={active} />
    </Canvas>
  );
}
