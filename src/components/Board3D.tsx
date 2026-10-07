import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, Sparkles, Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { isFrozen, isShielded, type Color, type Fx, type GameState, type PType } from "@/lib/chess";

const NEON: Record<Color, string> = { w: "#22e6ff", b: "#ff2fb4" };
const pos = (i: number): [number, number] => [(i % 8) - 3.5, Math.floor(i / 8) - 3.5];

// Lathe profiles (radius, height) per piece type
const PROFILES: Record<PType, [number, number][]> = {
  p: [[0.3, 0], [0.3, 0.08], [0.18, 0.15], [0.1, 0.35], [0.14, 0.42], [0.17, 0.52], [0.12, 0.62], [0, 0.66]],
  n: [[0.32, 0], [0.32, 0.08], [0.2, 0.18], [0.13, 0.45], [0.2, 0.5], [0, 0.52]],
  b: [[0.32, 0], [0.32, 0.08], [0.18, 0.18], [0.1, 0.55], [0.18, 0.62], [0.14, 0.8], [0.04, 0.9], [0, 0.94]],
  r: [[0.34, 0], [0.34, 0.08], [0.22, 0.18], [0.18, 0.6], [0.28, 0.66], [0.28, 0.82], [0, 0.82]],
  q: [[0.36, 0], [0.36, 0.08], [0.2, 0.2], [0.1, 0.75], [0.24, 0.85], [0.18, 1.0], [0.08, 1.05], [0, 1.08]],
  k: [[0.37, 0], [0.37, 0.08], [0.21, 0.2], [0.11, 0.85], [0.24, 0.93], [0.16, 1.1], [0, 1.12]],
};

function PieceMesh({ t, c, frozen, shielded }: { t: PType; c: Color; frozen: boolean; shielded: boolean }) {
  const geo = useMemo(() => new THREE.LatheGeometry(PROFILES[t].map(([x, y]) => new THREE.Vector2(x, y)), 32), [t]);
  const color = frozen ? "#bfe9ff" : NEON[c];
  const body = c === "w" ? "#d9f6ff" : "#1a0a1e";
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 2;
  });
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color={body} metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={c === "w" ? 0.35 : 0.6} />
      </mesh>
      {t === "n" && (
        <mesh position={[0, 0.68, 0.06]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.36, 0.42]} />
          <meshStandardMaterial color={body} metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={0.5} />
        </mesh>
      )}
      {t === "k" && (
        <group position={[0, 1.25, 0]}>
          <mesh><boxGeometry args={[0.06, 0.28, 0.06]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
          <mesh position={[0, 0.04, 0]}><boxGeometry args={[0.2, 0.06, 0.06]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        </group>
      )}
      {t === "q" && (
        <mesh position={[0, 1.15, 0]}><sphereGeometry args={[0.07, 16, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      )}
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.42, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {shielded && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.62, 24, 24]} />
          <meshBasicMaterial color="#7dffb0" transparent opacity={0.18} toneMapped={false} wireframe />
        </mesh>
      )}
      {frozen && (
        <mesh position={[0, 0.5, 0]}>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#aee6ff" transparent opacity={0.35} roughness={0} metalness={0.2} />
        </mesh>
      )}
    </group>
  );
}

function AnimatedPiece({ sq, children }: { sq: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [x, z] = pos(sq);
  useFrame((_, d) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-12 * Math.min(d, 0.05));
    g.position.x += (x - g.position.x) * k;
    g.position.z += (z - g.position.z) * k;
    const dist = Math.hypot(x - g.position.x, z - g.position.z);
    g.position.y = Math.min(dist * 0.6, 1.2);
  });
  return <group ref={ref} position={[x, 0, z]}>{children}</group>;
}

type Burst = { id: number; kind: Fx["kind"]; squares: number[]; born: number };

function Explosion({ at, color, size = 1 }: { at: [number, number]; color: string; size?: number }) {
  const ref = useRef<THREE.Points>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  const N = 120;
  const { geo, vel } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      v.push(new THREE.Vector3().randomDirection().multiplyScalar((1.5 + Math.random() * 3) * size).setY(Math.random() * 4 * size));
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return { geo: g, vel: v };
  }, [size]);
  useFrame((_, d) => {
    t.current += Math.min(d, 0.05);
    const tt = t.current;
    const arr = geo.attributes.position!.array as Float32Array;
    vel.forEach((v, i) => {
      arr[i * 3] = v.x * tt; arr[i * 3 + 1] = 0.4 + v.y * tt - 4 * tt * tt; arr[i * 3 + 2] = v.z * tt;
    });
    geo.attributes.position!.needsUpdate = true;
    if (ref.current) (ref.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - tt / 1.2);
    if (ring.current) {
      ring.current.scale.setScalar(1 + tt * 6 * size);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - tt * 1.5);
    }
    if (flash.current) flash.current.intensity = Math.max(0, 30 * (1 - tt * 3)) * size;
  });
  return (
    <group position={[at[0], 0, at[1]]}>
      <points ref={ref} geometry={geo}>
        <pointsMaterial color={color} size={0.12} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.3, 0.4, 48]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={flash} position={[0, 1, 0]} color={color} distance={6} />
    </group>
  );
}

function Lightning({ at }: { at: [number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    if (ref.current) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t.current * 1.6) * (Math.random() > 0.3 ? 1 : 0.3);
      ref.current.scale.x = 1 + Math.random() * 0.6;
    }
  });
  return (
    <mesh ref={ref} position={[at[0], 5, at[1]]}>
      <cylinderGeometry args={[0.08, 0.2, 10, 8]} />
      <meshBasicMaterial color="#fff36b" transparent toneMapped={false} />
    </mesh>
  );
}

function Effects({ bursts }: { bursts: Burst[] }) {
  return (
    <>
      {bursts.map((b) => {
        const last = b.squares[b.squares.length - 1]!;
        if (b.kind === "capture") return <Explosion key={b.id} at={pos(last)} color="#ff7a1a" size={1.2} />;
        if (b.kind === "bomb") {
          return (
            <group key={b.id}>
              <Explosion at={pos(b.squares[4] ?? last)} color="#ff3b1a" size={2.2} />
              {b.squares.map((s) => <Explosion key={s} at={pos(s)} color="#ffb21a" size={0.7} />)}
            </group>
          );
        }
        if (b.kind === "bolt") return <group key={b.id}><Lightning at={pos(last)} /><Explosion at={pos(last)} color="#fff36b" size={1.4} /></group>;
        if (b.kind === "freeze") return <Explosion key={b.id} at={pos(last)} color="#9fe8ff" size={0.8} />;
        if (b.kind === "shield") return <Explosion key={b.id} at={pos(last)} color="#7dffb0" size={0.7} />;
        if (b.kind === "teleport") return <group key={b.id}>{b.squares.map((s) => <Explosion key={s} at={pos(s)} color="#c084ff" size={0.9} />)}</group>;
        if (b.kind === "promote") return <Explosion key={b.id} at={pos(last)} color="#ffe14d" size={1.5} />;
        return null;
      })}
    </>
  );
}

function CameraShake({ trigger }: { trigger: number }) {
  const amt = useRef(0);
  useEffect(() => { if (trigger) amt.current = 0.25; }, [trigger]);
  useFrame(({ camera }, d) => {
    if (amt.current > 0.001) {
      camera.position.x += (Math.random() - 0.5) * amt.current;
      camera.position.y += (Math.random() - 0.5) * amt.current;
      amt.current *= Math.exp(-6 * d);
    }
  });
  return null;
}

export default function Board3D({
  state, flip, highlights, selected, onSquare,
}: {
  state: GameState; flip: boolean; highlights: Set<number>; selected: number | null; onSquare: (i: number) => void;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shake, setShake] = useState(0);
  const lastFx = useRef<number | undefined>(state.fx?.id);

  useEffect(() => {
    const fx = state.fx;
    if (!fx || fx.id === lastFx.current) return;
    lastFx.current = fx.id;
    if (fx.kind === "move") return;
    const b = { ...fx, born: Date.now() };
    setBursts((x) => [...x, b]);
    if (["capture", "bomb", "bolt"].includes(fx.kind)) setShake(Date.now());
    const to = setTimeout(() => setBursts((x) => x.filter((y) => y.id !== b.id)), 2000);
    return () => clearTimeout(to);
  }, [state.fx]);

  // stable keys: track piece identity by following moves
  const pieces = state.board.map((p, i) => (p ? { p, i } : null)).filter(Boolean) as { p: NonNullable<GameState["board"][number]>; i: number }[];
  const keyed = useStableKeys(state);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 9, flip ? -8 : 8], fov: 45 }}>
      <color attach="background" args={["#05030c"]} />
      <fog attach="fog" args={["#05030c", 14, 30]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 4]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 3, flip ? -6 : 6]} intensity={20} color={NEON.w} distance={14} />
      <pointLight position={[0, 3, flip ? 6 : -6]} intensity={20} color={NEON.b} distance={14} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={3} color={NEON.w} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        <Lightformer intensity={3} color={NEON.b} position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <Stars radius={40} depth={20} count={1500} factor={3} fade speed={1} />
      <Sparkles count={60} scale={[10, 3, 10]} position={[0, 1.5, 0]} size={2} color="#ffffff" speed={0.4} />

      {/* Arena base */}
      <mesh position={[0, -0.26, 0]} receiveShadow>
        <boxGeometry args={[9.2, 0.5, 9.2]} />
        <meshStandardMaterial color="#0b0816" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.3, 6.4, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>

      {Array.from({ length: 64 }, (_, i) => {
        const [x, z] = pos(i);
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        const hl = highlights.has(i);
        const isLast = state.last?.includes(i);
        const sel = selected === i;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh
              receiveShadow
              position={[0, -0.05, 0]}
              onClick={(e) => { e.stopPropagation(); onSquare(i); }}
              onPointerOver={() => (document.body.style.cursor = "pointer")}
              onPointerOut={() => (document.body.style.cursor = "")}
            >
              <boxGeometry args={[0.98, 0.1, 0.98]} />
              <meshStandardMaterial
                color={dark ? "#151030" : "#3a3f66"}
                metalness={0.6}
                roughness={0.35}
                emissive={sel ? "#ffe14d" : isLast ? "#ffb21a" : "#000000"}
                emissiveIntensity={sel ? 0.8 : isLast ? 0.25 : 0}
              />
            </mesh>
            {hl && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                {state.board[i] ? <ringGeometry args={[0.38, 0.47, 32]} /> : <circleGeometry args={[0.14, 24]} />}
                <meshBasicMaterial color={state.board[i] ? "#ff3b3b" : "#ffe14d"} toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}

      {pieces.map(({ p, i }) => (
        <group key={keyed[i]} onClick={(e) => { e.stopPropagation(); onSquare(i); }}>
          <AnimatedPiece sq={i}>
            <group rotation={[0, p.c === "w" ? Math.PI : 0, 0]}>
              <PieceMesh t={p.t} c={p.c} frozen={isFrozen(p, state.move)} shielded={isShielded(p, state.move)} />
            </group>
          </AnimatedPiece>
        </group>
      ))}

      <Effects bursts={bursts} />
      <CameraShake trigger={shake} />
      <OrbitControls enablePan={false} minDistance={7} maxDistance={16} maxPolarAngle={1.25} target={[0, 0, 0]} />
      <EffectComposer>
        <Bloom intensity={1.3} luminanceThreshold={0.25} mipmapBlur />
        <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} />
        <Vignette darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}

// Assign each piece a persistent key so it animates when it moves.
function useStableKeys(state: GameState) {
  const ref = useRef<{ keys: (string | null)[]; board: GameState["board"] } | null>(null);
  if (!ref.current) {
    ref.current = { keys: state.board.map((p, i) => (p ? `k${i}` : null)), board: state.board };
  } else if (ref.current.board !== state.board) {
    const prev = ref.current;
    const keys: (string | null)[] = Array(64).fill(null);
    const used = new Set<string>();
    // keep pieces that stayed
    state.board.forEach((p, i) => {
      const q = prev.board[i];
      if (p && q && q.c === p.c && (q.t === p.t) && prev.keys[i]) { keys[i] = prev.keys[i]!; used.add(keys[i]!); }
    });
    // moved pieces: match vanished ones of same color
    state.board.forEach((p, i) => {
      if (!p || keys[i]) return;
      const from = prev.board.findIndex((q, j) => q && q.c === p.c && (q.t === p.t || q.t === "p") && prev.keys[j] && !used.has(prev.keys[j]!) && !state.board[j]);
      const k = from >= 0 ? prev.keys[from]! : `n${i}-${Date.now()}`;
      keys[i] = k; used.add(k);
    });
    ref.current = { keys, board: state.board };
  }
  return ref.current.keys;
}
