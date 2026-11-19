"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePointerRef } from "@/components/flow/scene-utils";

const PARTICLES = 48;
// Pseudoaleatório fixo: a poeira fica igual a cada montagem e o render continua puro.
const rand = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

/**
 * Gema low-poly: coroa (cone baixo truncado) + pavilhão (cone longo), 8 lados, sombreamento facetado.
 * Gerada por código: nenhum arquivo de modelo para baixar.
 */
function gemGeometry() {
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

function Crystal({ active }: { active: boolean }) {
  const root = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Points>(null);
  const pointer = usePointerRef();
  const geo = useMemo(() => gemGeometry(), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo]);
  const dustGeo = useMemo(() => {
    const p = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i++) {
      const r = 1.7 + rand(i) * 1.3, t = rand(i + 99) * Math.PI * 2;
      p.set([Math.cos(t) * r, (rand(i + 199) - 0.5) * 2.6, Math.sin(t) * r * 0.6], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);

  useFrame(({ clock }, dt) => {
    if (!active) return;
    const d = Math.min(dt, 0.05);
    if (gem.current) gem.current.rotation.y += d * 0.32;
    if (root.current) {
      const k = 1 - Math.exp(-3 * d);
      root.current.rotation.x += (-pointer.current.y * 0.18 - root.current.rotation.x) * k;
      root.current.rotation.y += (pointer.current.x * 0.32 - root.current.rotation.y) * k;
      root.current.position.y = Math.sin(clock.elapsedTime / 1.6) * 0.06;
    }
    if (moon.current) {
      const t = clock.elapsedTime / 2.6;
      moon.current.position.set(Math.cos(t) * 1.95, 0, Math.sin(t) * 1.95);
    }
    if (dust.current) dust.current.rotation.y -= d * 0.04;
  });

  return (
    <group ref={root}>
      <group ref={gem} rotation={[0.18, 0.4, -0.08]}>
        <mesh geometry={geo}>
          <meshPhysicalMaterial color="#9440FF" emissive="#4A0FA8" emissiveIntensity={0.6} roughness={0.32} metalness={0.15} clearcoat={1} clearcoatRoughness={0.25} flatShading transparent opacity={0.94} />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#E2CCFF" transparent opacity={0.45} />
        </lineSegments>
        <mesh scale={0.42} position={[0, 0.05, 0]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial color="#C9A8FF" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <group rotation={[1.32, 0.22, -0.24]}>
        <mesh>
          <torusGeometry args={[1.95, 0.008, 6, 160]} />
          <meshBasicMaterial color="#C9A8FF" transparent opacity={0.55} />
        </mesh>
        <mesh ref={moon}>
          <sphereGeometry args={[0.055, 16, 12]} />
          <meshBasicMaterial color="#F5F3FF" />
        </mesh>
      </group>
      <points ref={dust} geometry={dustGeo}>
        <pointsMaterial color="#C9A8FF" size={0.035} transparent opacity={0.6} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

/** Cena do cristal (fundo transparente). `active` false congela o loop (fora da tela ou aba oculta). */
export default function CrystalScene3D({ active, onReady }: { active: boolean; onReady?: () => void }) {
  return (
    <Canvas
      aria-hidden
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ fov: 30, position: [0, 0.1, 5.6], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[-3, 4, 5]} intensity={2.2} color="#FFFFFF" />
      <pointLight position={[3, -1, -3]} intensity={30} color="#B98AFF" />
      <pointLight position={[-3, -2, 2]} intensity={12} color="#8000FF" />
      <Crystal active={active} />
    </Canvas>
  );
}
