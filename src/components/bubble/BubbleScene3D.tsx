"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePointerRef } from "@/components/flow/scene-utils";
import { B } from "./bubble-shape";

const rad = (d: number) => (d * Math.PI) / 180;
const rand = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
const GREEN = new THREE.Color("#2CF8B0");
const LILAC = new THREE.Color("#B98AFF");

/** Contorno do balão (círculo + rabicho) com o miolo vazado. */
function ringShape() {
  const s = new THREE.Shape();
  s.absarc(0, 0, 1, rad(B.tailFrom), rad(B.tailTo) + Math.PI * 2, false);
  s.lineTo(B.tip[0], B.tip[1]);
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, B.inner, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

function lineShape() {
  const { hw, hh } = B.line;
  const s = new THREE.Shape();
  s.moveTo(-hw + hh, -hh);
  s.lineTo(hw - hh, -hh);
  s.absarc(hw - hh, 0, hh, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hw + hh, hh);
  s.absarc(-hw + hh, 0, hh, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

const CHANNELS = [
  { c: "#2CF8B0", r: 0.075 }, { c: "#B98AFF", r: 0.06 }, { c: "#FFFFFF", r: 0.05 },
  { c: "#8000FF", r: 0.07 }, { c: "#2CF8B0", r: 0.05 },
];

function Bubble({ active, lit }: { active: boolean; lit: number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lines = useRef<(THREE.Mesh | null)[]>([]);
  const orbit = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Points>(null);
  const pointer = usePointerRef();

  const ring = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(ringShape(), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 72 });
    g.translate(0, 0, -0.13);
    return g;
  }, []);
  const disc = useMemo(() => {
    const g = new THREE.CylinderGeometry(B.inner + 0.01, B.inner + 0.01, 0.1, 64);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const line = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(lineShape(), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 16 });
    g.translate(0, 0, 0.02);
    return g;
  }, []);
  const dustGeo = useMemo(() => {
    const n = 60, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 1.6 + rand(i) * 1.6, t = rand(i + 99) * Math.PI * 2;
      p.set([Math.cos(t) * r, (rand(i + 199) - 0.5) * 2.8, Math.sin(t) * r * 0.5 - 0.6], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);

  useFrame(({ clock }, dt) => {
    if (!active) return;
    const t = clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    const k = 1 - Math.exp(-3 * d);
    if (root.current) {
      root.current.rotation.x += (-pointer.current.y * 0.14 - root.current.rotation.x) * k;
      root.current.rotation.y += (pointer.current.x * 0.22 - root.current.rotation.y) * k;
      root.current.position.y = Math.sin(t / 1.0) * 0.06;
    }
    // Balanço lento (não gira inteiro, para as linhas continuarem legíveis).
    if (body.current) {
      body.current.rotation.y = Math.sin(t * 0.45) * 0.32;
      body.current.rotation.z = Math.sin(t * 0.3) * 0.05;
    }
    // "Digitando": as linhas acendem em sequência; as já feitas (progresso) ficam verdes.
    lines.current.forEach((m, i) => {
      if (!m) return;
      const phase = ((t * 0.9 - i * 0.35) % 1.8 + 1.8) % 1.8;
      const pulse = phase < 0.6 ? Math.sin((phase / 0.6) * Math.PI) : 0;
      m.scale.x = 0.82 + pulse * 0.18;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (i < lit ? 0.9 : 0.35) + pulse * 0.9;
    });
    if (orbit.current) orbit.current.rotation.y += d * 0.22;
    if (dust.current) dust.current.rotation.y -= d * 0.035;
  });

  return (
    <group ref={root}>
      <group ref={body} rotation={[0.08, -0.22, 0]}>
        <mesh geometry={ring}>
          <meshPhysicalMaterial color="#2CF8B0" emissive="#0E6E4C" emissiveIntensity={0.55} roughness={0.22} metalness={0.25} clearcoat={1} clearcoatRoughness={0.18} />
        </mesh>
        <mesh geometry={disc} position={[0, 0, -0.04]}>
          <meshPhysicalMaterial color="#2A0A66" emissive="#3D1198" emissiveIntensity={0.7} roughness={0.15} metalness={0} transmission={0.2} transparent opacity={0.92} clearcoat={1} />
        </mesh>
        {B.line.ys.map((y, i) => (
          <mesh key={i} ref={(m) => { lines.current[i] = m; }} geometry={line} position={[B.line.cx, y, 0]}>
            <meshStandardMaterial color={i < lit ? GREEN : LILAC} emissive={i < lit ? GREEN : LILAC} emissiveIntensity={0.5} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {/* Canais orbitando o balão. */}
      <group rotation={[1.25, 0, -0.28]}>
        <mesh>
          <torusGeometry args={[1.75, 0.006, 6, 180]} />
          <meshBasicMaterial color="#C9A8FF" transparent opacity={0.4} />
        </mesh>
        <group ref={orbit}>
          {CHANNELS.map((ch, i) => {
            const a = (i / CHANNELS.length) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75]}>
                <sphereGeometry args={[ch.r, 20, 14]} />
                <meshStandardMaterial color={ch.c} emissive={ch.c} emissiveIntensity={0.8} />
              </mesh>
            );
          })}
        </group>
      </group>
      <points ref={dust} geometry={dustGeo}>
        <pointsMaterial color="#C9A8FF" size={0.03} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

/** Balão da logo em 3D (fundo transparente). `lit` = quantas linhas ficam verdes (progresso). */
export default function BubbleScene3D({ active, onReady, lit = 1 }: { active: boolean; onReady?: () => void; lit?: number }) {
  return (
    <Canvas
      aria-hidden
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ fov: 30, position: [0, 0, 6.2], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[-3, 4, 5]} intensity={2.4} color="#FFFFFF" />
      <pointLight position={[3, -1, 2]} intensity={22} color="#8000FF" />
      <pointLight position={[-3, -2, -2]} intensity={14} color="#2CF8B0" />
      <Bubble active={active} lit={lit} />
    </Canvas>
  );
}
