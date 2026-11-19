"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALCO, SINAL, VIOLETA } from "./model";
import { FitCamera, usePageVisible } from "./scene-utils";

const CHANNELS = 5;
const mat = (color: string, emissive = 0.2) => <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.4} />;

// Aba do envelope: triângulo apontando para baixo, extrudado.
const flapGeo = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.42, 0.29);
  sh.lineTo(0.42, 0.29);
  sh.lineTo(0, -0.06);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
  g.translate(0, 0, -0.02);
  return g;
})();

/** Cinco formas abstratas, sem marcas: conversa, globo, envelope, engrenagem e fluxo. */
function Shape({ i }: { i: number }) {
  const c = "#8f7cff";
  switch (i) {
    case 0: // balão de conversa
      return (
        <group>
          <mesh scale={[1, 0.72, 0.5]}>
            <sphereGeometry args={[0.42, 24, 16]} />
            {mat(c)}
          </mesh>
          <mesh position={[-0.2, -0.38, 0]} rotation={[0, 0, Math.PI * 0.85]}>
            <coneGeometry args={[0.12, 0.26, 4]} />
            {mat(c)}
          </mesh>
        </group>
      );
    case 1: // globo
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.36, 20, 14]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} wireframe />
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[0.44, 0.025, 8, 40]} />
            {mat("#efe8ff", 0.6)}
          </mesh>
        </group>
      );
    case 2: // envelope: corpo com volume, aba triangular em relevo e selo
      return (
        <group rotation={[0.12, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.84, 0.58, 0.16]} />
            <meshStandardMaterial color="#5a46d8" emissive="#5a46d8" emissiveIntensity={0.18} roughness={0.5} />
          </mesh>
          <mesh geometry={flapGeo} position={[0, 0, 0.085]}>
            <meshStandardMaterial color="#cfc4ff" emissive="#9d8cff" emissiveIntensity={0.25} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.02, 0.1]}>
            <sphereGeometry args={[0.045, 12, 8]} />
            <meshStandardMaterial color="#9F7AFA" emissive="#9F7AFA" emissiveIntensity={0.8} />
          </mesh>
        </group>
      );
    case 3: // engrenagem
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.28, 0.28, 0.14, 24]} />
            {mat(c)}
          </mesh>
          {Array.from({ length: 8 }, (_, k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI) / 4) * 0.36, 0, Math.sin((k * Math.PI) / 4) * 0.36]} rotation={[0, -(k * Math.PI) / 4, 0]}>
              <boxGeometry args={[0.14, 0.14, 0.12]} />
              {mat(c)}
            </mesh>
          ))}
        </group>
      );
    default: // fluxo / automação
      return (
        <group>
          {[[-0.32, -0.18], [0.02, 0.2], [0.34, -0.12]].map(([x, y], k) => (
            <mesh key={k} position={[x, y, 0]}>
              <sphereGeometry args={[0.11, 16, 12]} />
              {mat(k === 1 ? "#efe8ff" : c, 0.6)}
            </mesh>
          ))}
          <mesh position={[-0.15, 0.01, 0]} rotation={[0, 0, 1.0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.45, 6]} />
            {mat(c)}
          </mesh>
          <mesh position={[0.18, 0.04, 0]} rotation={[0, 0, -1.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
            {mat(c)}
          </mesh>
        </group>
      );
  }
}

const PAD = 2.0; // folga em volta da órbita para o tamanho das formas
const TILT = 0.55; // inclinação do plano da órbita: o topo recua, a base avança

/**
 * Elipse da órbita conforme a proporção do palco, de modo que órbita + formas preencham a cena
 * (sem sobra embaixo no celular).
 */
function orbitDims(w: number, h: number) {
  const aspect = w / Math.max(h, 1);
  const rx = Math.min(5.2, Math.max(1.9, aspect * 2.2));
  const ry = Math.min(4.2, Math.max(1.5, (2 * rx + PAD) / aspect / 2 - PAD / 2));
  return { rx, ry };
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function Hub({ still }: { still: boolean }) {
  const { width: sw, height: sh } = useThree((s) => s.size);
  const { rx, ry } = orbitDims(sw, sh);
  const core = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const chan = useRef<(THREE.Group | null)[]>([]);
  const caps = useRef<(THREE.Group | null)[]>([]);
  const lines = useRef<(THREE.Mesh | null)[]>([]);
  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

  // Anel fino e translúcido da órbita (a mesma elipse inclinada em que os canais andam).
  const ringGeo = useMemo(() => {
    const pts = Array.from({ length: 96 }, (_, k) => {
      const t = (k / 96) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry, -Math.sin(t) * ry * TILT);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, 0.014, 6, true);
  }, [rx, ry]);

  useFrame(({ clock, size }) => {
    // parado: tempo fixo, então órbita, cápsulas e núcleo ficam numa pose fixa
    const t = still ? 1.2 : clock.getElapsedTime();
    const { rx: X, ry: Y } = orbitDims(size.width, size.height);
    let hit = 0;
    for (let i = 0; i < CHANNELS; i++) {
      const g = chan.current[i];
      const cap = caps.current[i];
      const line = lines.current[i];
      if (!g || !cap || !line) continue;
      // ângulos regulares; a órbita gira devagar e mantém o espaçamento
      const ang = t * 0.1 + (i * Math.PI * 2) / CHANNELS + Math.PI / 2;
      g.position.set(Math.cos(ang) * X, Math.sin(ang) * Y, -Math.sin(ang) * Y * TILT);
      g.rotation.set(0.1, Math.sin(t * 0.5 + i) * 0.45, 0);
      // trajeto canal -> núcleo (reto, da borda da forma até a borda do núcleo)
      dir.current.copy(g.position).negate().normalize();
      a.current.copy(g.position).addScaledVector(dir.current, 0.95);
      b.current.set(0, 0, 0).addScaledVector(dir.current, -1.2);
      const len = a.current.distanceTo(b.current);
      line.position.copy(a.current).add(b.current).multiplyScalar(0.5);
      line.quaternion.setFromUnitVectors(Y_AXIS, dir.current);
      line.scale.set(1, len, 1);
      // cápsula de mensagem: percorre o trajeto da forma ao núcleo, apontando para o núcleo
      const ph = (t * 0.3 + i / CHANNELS) % 1;
      cap.position.copy(a.current).lerp(b.current, ph);
      cap.quaternion.setFromUnitVectors(Y_AXIS, dir.current);
      cap.scale.setScalar(Math.min(1, ph * 5, (1 - ph) * 5) * 0.9 + 0.1);
      if (ph > 0.88) hit = Math.max(hit, (ph - 0.88) / 0.12);
    }
    if (core.current) {
      core.current.rotation.y = t * 0.2;
      core.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.025 + hit * 0.05);
    }
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + hit * 0.14;
  });

  return (
    <>
      <FitCamera width={rx * 2 + PAD} height={ry * 2 + PAD} sway={0.7} margin={1.04} still={still} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <pointLight position={[0, 0, 0]} intensity={10} color={VIOLETA} />
      <mesh geometry={ringGeo}>
        <meshBasicMaterial color="#a68bff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <group ref={core}>
        <mesh>
          <icosahedronGeometry args={[0.85, 1]} />
          <meshStandardMaterial color={VIOLETA} emissive={VIOLETA} emissiveIntensity={0.7} roughness={0.3} flatShading />
        </mesh>
        <mesh scale={1.35}>
          <icosahedronGeometry args={[0.85, 1]} />
          <meshBasicMaterial color="#a68bff" wireframe transparent opacity={0.35} />
        </mesh>
      </group>
      <mesh ref={glow} scale={1.9}>
        <sphereGeometry args={[0.85, 24, 16]} />
        <meshBasicMaterial color={VIOLETA} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {Array.from({ length: CHANNELS }, (_, i) => (
        <group key={i}>
          <mesh ref={(el) => { lines.current[i] = el; }}>
            <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
            <meshBasicMaterial color={SINAL} transparent opacity={0.28} depthWrite={false} />
          </mesh>
          <group ref={(el) => { chan.current[i] = el; }}>
            <group scale={1.4}>
              <Shape i={i} />
            </group>
          </group>
          <group ref={(el) => { caps.current[i] = el; }}>
            <mesh>
              <capsuleGeometry args={[0.06, 0.2, 4, 10]} />
              <meshBasicMaterial color="#efe8ff" />
            </mesh>
            <mesh scale={[1.9, 1.5, 1.9]}>
              <capsuleGeometry args={[0.06, 0.2, 4, 10]} />
              <meshBasicMaterial color={SINAL} transparent opacity={0.35} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/** `still`: prefers-reduced-motion. Um único quadro, sem órbita, cápsulas em movimento nem parallax. */
export default function HubScene3D({ still = false, onReady }: { still?: boolean; onReady?: () => void }) {
  const visible = usePageVisible();
  return (
    <Canvas
      aria-hidden
      frameloop={still ? "demand" : visible ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ fov: 18, position: [0, 0, 40], near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(PALCO);
        requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Hub still={still} />
    </Canvas>
  );
}
