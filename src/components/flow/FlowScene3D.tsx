"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import { DECISAO, PALCO, SINAL, VIOLETA, edgeControls, layoutFlow, stateLabel, type Flow, type FlowNode } from "./model";
import { FitCamera, usePageVisible } from "./scene-utils";

const U = 0.02; // unidades do layout -> mundo
const R = 0.3; // raio base de um nó

type Pt = { x: number; y: number; z: number };

function Node({ still, n, p, color, hovered, onHover, onOpen }: { still: boolean; n: FlowNode; p: Pt; color: string; hovered: boolean; onHover: (h: boolean) => void; onOpen: () => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  const done = n.state === "feito";
  const next = n.state === "proximo";
  // Órbita: concluído aceso em lavanda (--sinal), próximo branco com pulso, pendente escuro com contorno visível.
  const pending = "#2A2638";

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring.current) {
      // parado: anel fixo que só marca o próximo nó; em movimento: pulso
      const ph = still ? 0.25 : (t % 1.8) / 1.8;
      ring.current.scale.setScalar(1 + ph * 1.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = still ? 0.7 : (1 - ph) * 0.9;
    }
    if (body.current) body.current.scale.setScalar((hovered ? 1.2 : 1) * (next && !still ? 1 + Math.sin(t * 3.5) * 0.06 : 1));
  });

  return (
    <group position={[p.x, p.y, p.z]}>
      <group
        ref={body}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "";
          onOpen();
        }}
      >
        {n.kind === "aula" &&
          (n.reading ? (
            <mesh scale={0.8}>
              <capsuleGeometry args={[R * 0.5, R * 0.5, 6, 16]} />
              <meshStandardMaterial color={done ? SINAL : pending} transparent opacity={done ? 1 : 0.55} emissive={done ? SINAL : pending} emissiveIntensity={done ? 0.45 : 0.12} roughness={0.5} />
            </mesh>
          ) : (
            // nó de cristal (octaedro alongado, facetado)
            <mesh scale={[0.9, 1.25, 0.9]} rotation={[0, Math.PI / 4, 0]}>
              <octahedronGeometry args={[R * 1.05, 0]} />
              <meshStandardMaterial
                color={done ? SINAL : next ? "#ffffff" : pending}
                emissive={done ? SINAL : next ? SINAL : pending}
                emissiveIntensity={done ? 0.55 : next ? 0.5 : 0.1}
                roughness={done || next ? 0.3 : 0.6}
                metalness={0.15}
                flatShading
              />
              <Edges color={done || next ? "#F5F3FF" : "#6E6888"} />
            </mesh>
          ))}
        {done && n.kind === "aula" && !n.reading && (
          <mesh>
            <sphereGeometry args={[R * 1.45, 24, 16]} />
            <meshBasicMaterial color={SINAL} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        )}
        {n.kind === "quiz" && (
          <mesh scale={[1, 1.25, 0.6]}>
            <octahedronGeometry args={[R * 1.15, 0]} />
            {/* quiz feito vira progresso (lavanda); pendente fica âmbar (pede ação) */}
            <meshStandardMaterial color={done ? SINAL : "#4A3A1A"} emissive={done ? SINAL : DECISAO} emissiveIntensity={done ? 0.5 : next ? 0.45 : 0.18} roughness={0.35} flatShading />
            <Edges color={done ? "#F5F3FF" : DECISAO} />
          </mesh>
        )}
        {n.kind === "certificado" && (
          <group>
            <mesh>
              <torusGeometry args={[R * 1.1, R * 0.3, 16, 40]} />
              <meshStandardMaterial color={VIOLETA} emissive={VIOLETA} emissiveIntensity={done ? 0.8 : 0.25} roughness={0.3} />
            </mesh>
            <mesh>
              <sphereGeometry args={[R * 0.5, 24, 16]} />
              <meshStandardMaterial color={done ? "#ffffff" : "#3a3270"} emissive={done ? SINAL : "#000000"} emissiveIntensity={done ? 0.5 : 0} />
            </mesh>
          </group>
        )}
        {/* alvo de clique maior que o desenho */}
        <mesh visible={false}>
          <sphereGeometry args={[R * 1.8, 8, 8]} />
        </mesh>
      </group>
      {next && (
        <mesh ref={ring}>
          <ringGeometry args={[R * 1.25, R * 1.4, 48]} />
          <meshBasicMaterial color={SINAL} transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {hovered && (
        <Html position={[0, R * 2.4, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "#1B1826",
              color: "#F5F3FF",
              border: "1px solid #3A3550",
              padding: "6px 10px",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              maxWidth: 260,
              overflow: "hidden",
              textOverflow: "ellipsis",
              boxShadow: "0 2px 12px rgba(0,0,0,.35)",
            }}
          >
            {n.title} <span style={{ color: "#C3BED6" }}>({stateLabel(n)})</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Partículas de sinal que percorrem os conectores já percorridos até o próximo nó, em laço. */
function Signal({ curves }: { curves: THREE.CubicBezierCurve3[] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const COUNT = 3;
  useFrame(({ clock }) => {
    const N = curves.length;
    if (!N) return;
    const t = clock.getElapsedTime();
    const speed = Math.max(0.35, Math.min(1.4, 2.4 / N)); // conectores por segundo
    for (let i = 0; i < COUNT; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const u = (t * speed + (i * N) / COUNT) % N;
      const idx = Math.min(Math.floor(u), N - 1);
      curves[idx].getPoint(u - idx, g.position);
    }
  });
  if (!curves.length) return null;
  return (
    <>
      {Array.from({ length: COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <mesh>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshBasicMaterial color="#efe8ff" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshBasicMaterial color={SINAL} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function World({ flow, vertical, still }: { flow: Flow; vertical: boolean; still: boolean }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const layout = useMemo(() => layoutFlow(flow.nodes.length, vertical ? "vertical" : "horizontal"), [flow.nodes.length, vertical]);
  // Enquadra a caixa dos nós (não o retângulo do layout): sem sobra de espaço embaixo no celular.
  const box = useMemo(() => {
    const xs = layout.points.map((p) => p.x);
    const ys = layout.points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: (maxX - minX) * U + 1.5, h: (maxY - minY) * U + 1.5 };
  }, [layout]);
  const toWorld = useMemo(
    () => (q: { x: number; y: number }, z: number) => new THREE.Vector3((q.x - box.cx) * U, -(q.y - box.cy) * U, z),
    [box],
  );
  const pts: Pt[] = useMemo(() => layout.points.map((p, i) => ({ ...toWorld(p, i % 2 ? 0.25 : -0.25) })), [layout, toWorld]);
  const curves = useMemo(
    () =>
      flow.edges.map((e) => {
        const [c1, c2] = edgeControls(layout.points[e.from], layout.points[e.to], layout.orientation);
        const a = pts[e.from];
        const b = pts[e.to];
        return new THREE.CubicBezierCurve3(new THREE.Vector3(a.x, a.y, a.z), toWorld(c1, a.z), toWorld(c2, b.z), new THREE.Vector3(b.x, b.y, b.z));
      }),
    [flow.edges, layout, pts, toWorld],
  );
  const lit = useMemo(() => curves.filter((_, i) => flow.edges[i].done), [curves, flow.edges]);

  return (
    <>
      <FitCamera width={box.w} height={box.h} sway={vertical ? 0.3 : 0.6} margin={1.04} still={still} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 6]} intensity={2.2} />
      <pointLight position={[-4, -2, 4]} intensity={8} color={SINAL} />
      {curves.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 28, flow.edges[i].done ? 0.05 : 0.035, 8, false]} />
          <meshStandardMaterial
            color={flow.edges[i].done ? SINAL : "#3a3652"}
            emissive={flow.edges[i].done ? SINAL : "#000000"}
            emissiveIntensity={flow.edges[i].done ? 0.7 : 0}
            roughness={0.5}
          />
        </mesh>
      ))}
      {!still && <Signal curves={lit} />}
      {flow.nodes.map((n, i) => (
        <Node
          key={n.id}
          n={n}
          p={pts[i]}
          color={flow.color}
          hovered={hover === i}
          still={still}
          onHover={(h) => setHover((cur) => (h ? i : cur === i ? null : cur))}
          onOpen={() => router.push(n.href)}
        />
      ))}
    </>
  );
}

/** `still`: prefers-reduced-motion. Desenha um quadro e só redesenha quando algo muda (hover, resize). */
export default function FlowScene3D({ flow, vertical, still = false, onReady }: { flow: Flow; vertical: boolean; still?: boolean; onReady?: () => void }) {
  const visible = usePageVisible();
  return (
    <Canvas
      aria-hidden
      frameloop={still ? "demand" : visible ? "always" : "never"}
      dpr={vertical ? [1, 1.5] : [1, 2]}
      camera={{ fov: 18, position: [0, 0, 40], near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(PALCO);
        requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <World flow={flow} vertical={vertical} still={still} />
    </Canvas>
  );
}
