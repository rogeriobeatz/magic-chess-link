import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  isFrozen,
  isShielded,
  isKingThreatened,
  bombArea,
  type Color,
  type Fx,
  type GameState,
  type PType,
} from "@/lib/chess";

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--arena-3d-${name}`).trim();
const neon = (c: Color) => token(c === "w" ? "cyan" : "magenta");
const pos = (i: number): [number, number] => [(i % 8) - 3.5, Math.floor(i / 8) - 3.5];

// Lathe profiles (radius, height) per piece type
const BASE: [number, number][] = [
  [0, 0],
  [0.36, 0],
  [0.38, 0.05],
  [0.38, 0.09],
  [0.33, 0.13],
  [0.31, 0.17],
  [0.32, 0.21],
  [0.26, 0.25],
];
const PROFILES: Record<PType, [number, number][]> = {
  p: [
    ...BASE,
    [0.19, 0.29],
    [0.13, 0.48],
    [0.12, 0.56],
    [0.21, 0.58],
    [0.21, 0.62],
    [0.1, 0.66],
    [0, 0.66],
  ],
  n: [...BASE, [0.2, 0.31], [0.18, 0.47], [0, 0.5]],
  b: [
    ...BASE,
    [0.19, 0.3],
    [0.11, 0.64],
    [0.14, 0.71],
    [0.23, 0.73],
    [0.23, 0.78],
    [0.12, 0.82],
    [0.2, 0.96],
    [0.14, 1.12],
    [0.04, 1.25],
    [0, 1.28],
  ],
  r: [...BASE, [0.21, 0.3], [0.18, 0.87], [0.28, 0.89], [0.29, 0.96], [0.27, 1.08], [0, 1.08]],
  q: [
    ...BASE,
    [0.2, 0.33],
    [0.11, 0.84],
    [0.2, 0.93],
    [0.26, 0.96],
    [0.2, 1.07],
    [0.22, 1.14],
    [0.3, 1.28],
    [0.22, 1.32],
    [0, 1.32],
  ],
  k: [
    ...BASE,
    [0.2, 0.33],
    [0.11, 0.92],
    [0.24, 1],
    [0.25, 1.06],
    [0.16, 1.12],
    [0.18, 1.3],
    [0.12, 1.37],
    [0, 1.38],
  ],
};

function HorseHead({ color, body }: { color: string; body: string }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.23, 0.4);
    shape.bezierCurveTo(-0.29, 0.7, -0.22, 1.06, 0.06, 1.25);
    shape.lineTo(0.1, 1.43);
    shape.lineTo(0.21, 1.29);
    shape.lineTo(0.3, 1.21);
    shape.lineTo(0.36, 0.98);
    shape.lineTo(0.23, 0.87);
    shape.lineTo(0.07, 0.94);
    shape.bezierCurveTo(-0.01, 0.8, 0.18, 0.65, 0.22, 0.43);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.035,
    });
  }, []);
  return (
    <group rotation={[0, -Math.PI / 6, 0]}>
      <mesh geometry={geometry} position={[0, 0, -0.11]} castShadow>
        <meshPhysicalMaterial
          color={body}
          emissive={color}
          emissiveIntensity={0.18}
          metalness={0.6}
          roughness={0.16}
          clearcoat={1}
        />
      </mesh>
      {[-0.16, 0.16].map((z) => (
        <mesh key={z} position={[0.19, 1.13, z]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshBasicMaterial color={token("white")} />
        </mesh>
      ))}
    </group>
  );
}

function PieceMesh({
  t,
  c,
  frozen,
  shielded,
}: {
  t: PType;
  c: Color;
  frozen: boolean;
  shielded: boolean;
}) {
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        PROFILES[t].map(([x, y]) => new THREE.Vector2(x, y)),
        64,
      ),
    [t],
  );
  const color = frozen ? token("ice") : neon(c);
  const body = c === "w" ? token("body-white") : token("body-black");
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 2;
  });
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={body}
          metalness={0.6}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive={color}
          emissiveIntensity={0.18}
        />
      </mesh>
      {t === "p" && (
        <mesh position={[0, 0.79, 0]} castShadow>
          <sphereGeometry args={[0.19, 24, 24]} />
          <meshPhysicalMaterial
            color={body}
            metalness={0.6}
            roughness={0.14}
            clearcoat={1}
            emissive={color}
            emissiveIntensity={0.2}
          />
        </mesh>
      )}
      {t === "n" && <HorseHead color={color} body={body} />}
      {t === "r" &&
        Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI) / 3) * 0.22,
              1.13,
              Math.sin((i * Math.PI) / 3) * 0.22,
            ]}
            rotation={[0, (-i * Math.PI) / 3, 0]}
          >
            <boxGeometry args={[0.14, 0.18, 0.14]} />
            <meshPhysicalMaterial
              color={body}
              emissive={color}
              emissiveIntensity={0.2}
              metalness={0.6}
              roughness={0.16}
            />
          </mesh>
        ))}
      {t === "q" &&
        Array.from({ length: 7 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI * 2) / 7) * 0.24,
              1.35,
              Math.sin((i * Math.PI * 2) / 7) * 0.24,
            ]}
          >
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        ))}
      {[0.075, 0.2, t === "p" ? 0.6 : 0.96].map((height, i) => (
        <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry
            args={[i === 0 ? 0.37 : i === 1 ? 0.3 : t === "p" ? 0.19 : 0.22, 0.016, 8, 40]}
          />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {t === "k" && (
        <group position={[0, 1.52, 0]}>
          <mesh>
            <boxGeometry args={[0.06, 0.28, 0.06]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.06]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      )}
      {t === "q" && (
        <mesh position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.42, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {shielded && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.62, 24, 24]} />
          <meshBasicMaterial
            color={token("shield")}
            transparent
            opacity={0.18}
            toneMapped={false}
            wireframe
          />
        </mesh>
      )}
      {frozen && (
        <mesh position={[0, 0.5, 0]}>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial
            color={token("frost")}
            transparent
            opacity={0.35}
            roughness={0}
            metalness={0.2}
          />
        </mesh>
      )}
    </group>
  );
}

function AnimatedPiece({
  sq,
  kind,
  type,
  animate,
  children,
}: {
  sq: number;
  kind: Fx["kind"] | undefined;
  type: PType;
  animate: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  // Keep the mount position stable: changing the JSX position to the new square
  // makes Three.js snap there before the animation can start.
  const initial = useRef<[number, number, number]>([pos(sq)[0], 0, pos(sq)[1]]);
  const motion = useRef({ from: pos(sq), to: pos(sq), elapsed: 1 });
  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    motion.current = {
      from: [group.position.x, group.position.z],
      to: pos(sq),
      elapsed: animate ? 0 : 1,
    };
  }, [sq, animate]);
  useFrame((_, d) => {
    const g = ref.current;
    if (!g) return;
    const m = motion.current;
    m.elapsed = Math.min(1, m.elapsed + d / 0.65);
    const t = m.elapsed;
    const ease = t * t * (3 - 2 * t);
    const moving = Math.hypot(m.from[0] - m.to[0], m.from[1] - m.to[1]) > 0.01;
    const teleport = kind === "teleport" && moving;
    const progress = teleport ? (t < 0.5 ? 0 : 1) : ease;
    g.position.set(
      THREE.MathUtils.lerp(m.from[0], m.to[0], progress),
      moving ? Math.sin(Math.PI * t) * (type === "n" ? 1.15 : 0.22) : 0,
      THREE.MathUtils.lerp(m.from[1], m.to[1], progress),
    );
    g.scale.setScalar(teleport ? Math.max(0.03, Math.abs(2 * t - 1)) : 1);
    g.rotation.y = teleport ? Math.sin(Math.PI * t) * Math.PI * 2 : 0;
  });
  return (
    <group ref={ref} position={initial.current}>
      {children}
    </group>
  );
}

function useMarbleTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f2f4ff";
    ctx.fillRect(0, 0, 256, 256);
    // Deterministic veins keep the material consistent across rerenders.
    for (let vein = 0; vein < 18; vein++) {
      ctx.beginPath();
      for (let x = -20; x <= 276; x += 4) {
        const y =
          vein * 23 -
          70 +
          x * 0.48 +
          Math.sin(x * 0.043 + vein * 2.4) * 14 +
          Math.sin(x * 0.13 + vein) * 3;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = vein % 3 === 0 ? "rgba(62, 89, 131, 0.32)" : "rgba(80, 110, 150, 0.13)";
      ctx.lineWidth = vein % 3 === 0 ? 0.9 : 2.5;
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function CheckRing({ sq }: { sq: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.1);
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.55 + Math.sin(clock.elapsedTime * 5) * 0.2;
    }
  });
  const [x, z] = pos(sq);
  return (
    <mesh ref={ref} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.43, 0.49, 48]} />
      <meshBasicMaterial
        color={token("target")}
        transparent
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function BeveledFrame() {
  const geometry = useMemo(() => {
    const outer = 4.39,
      cut = 0.22,
      inner = 4.25;
    const shape = new THREE.Shape();
    shape.moveTo(-outer + cut, -outer);
    shape.lineTo(outer - cut, -outer);
    shape.lineTo(outer, -outer + cut);
    shape.lineTo(outer, outer - cut);
    shape.lineTo(outer - cut, outer);
    shape.lineTo(-outer + cut, outer);
    shape.lineTo(-outer, outer - cut);
    shape.lineTo(-outer, -outer + cut);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-inner, -inner);
    hole.lineTo(-inner, inner);
    hole.lineTo(inner, inner);
    hole.lineTo(inner, -inner);
    hole.closePath();
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.04,
      bevelSegments: 2,
      steps: 1,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.07, 0]}
      receiveShadow
    >
      <meshStandardMaterial
        color={token("gold")}
        emissive={token("gold")}
        emissiveIntensity={0.18}
        metalness={0.8}
        roughness={0.24}
      />
    </mesh>
  );
}

type Burst = { id: number; kind: Fx["kind"]; squares: number[]; born: number };

function Explosion({
  at,
  color,
  size = 1,
}: {
  at: [number, number];
  color: string;
  size?: number;
}) {
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
      v.push(
        new THREE.Vector3()
          .randomDirection()
          .multiplyScalar((1.5 + Math.random() * 3) * size)
          .setY(Math.random() * 4 * size),
      );
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return { geo: g, vel: v };
  }, [size]);
  useFrame((_, d) => {
    t.current += Math.min(d, 0.05);
    const tt = t.current;
    const attribute = geo.getAttribute("position");
    const arr = attribute.array as Float32Array;
    vel.forEach((v, i) => {
      arr[i * 3] = v.x * tt;
      arr[i * 3 + 1] = 0.4 + v.y * tt - 4 * tt * tt;
      arr[i * 3 + 2] = v.z * tt;
    });
    attribute.needsUpdate = true;
    if (ref.current)
      (ref.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - tt / 1.2);
    if (ring.current) {
      ring.current.scale.setScalar(1 + tt * 6 * size);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - tt * 1.5);
    }
    if (flash.current) flash.current.intensity = Math.max(0, 30 * (1 - tt * 3)) * size;
  });
  return (
    <group position={[at[0], 0, at[1]]}>
      <points ref={ref} geometry={geo}>
        <pointsMaterial
          color={color}
          size={0.12}
          transparent
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
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
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, 1 - t.current * 1.6) * (Math.random() > 0.3 ? 1 : 0.3);
      ref.current.scale.x = 1 + Math.random() * 0.6;
    }
  });
  return (
    <mesh ref={ref} position={[at[0], 5, at[1]]}>
      <cylinderGeometry args={[0.08, 0.2, 10, 8]} />
      <meshBasicMaterial color={token("bolt")} transparent toneMapped={false} />
    </mesh>
  );
}

function Effects({ bursts }: { bursts: Burst[] }) {
  return (
    <>
      {bursts.map((b) => {
        const last = b.squares[b.squares.length - 1];
        if (last === undefined) return null;
        if (b.kind === "capture")
          return <Explosion key={b.id} at={pos(last)} color={token("flame")} size={1.2} />;
        if (b.kind === "bomb") {
          return (
            <group key={b.id}>
              <Explosion at={pos(b.squares[0] ?? last)} color={token("blast")} size={2.2} />
              {b.squares.map((s) => (
                <Explosion key={s} at={pos(s)} color={token("amber")} size={0.7} />
              ))}
            </group>
          );
        }
        if (b.kind === "bolt")
          return (
            <group key={b.id}>
              <Lightning at={pos(last)} />
              <Explosion at={pos(last)} color={token("bolt")} size={1.4} />
            </group>
          );
        if (b.kind === "freeze")
          return <Explosion key={b.id} at={pos(last)} color={token("ice")} size={0.8} />;
        if (b.kind === "shield")
          return <Explosion key={b.id} at={pos(last)} color={token("shield")} size={0.7} />;
        if (b.kind === "teleport")
          return (
            <group key={b.id}>
              {b.squares.map((s) => (
                <Explosion key={s} at={pos(s)} color={token("violet")} size={0.9} />
              ))}
            </group>
          );
        if (b.kind === "promote")
          return <Explosion key={b.id} at={pos(last)} color={token("selection")} size={1.5} />;
        return null;
      })}
    </>
  );
}

function CameraShake({ trigger }: { trigger: number }) {
  const amt = useRef(0);
  useEffect(() => {
    if (trigger) amt.current = 0.25;
  }, [trigger]);
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
  state,
  flip,
  highlights,
  selected,
  onSquare,
  effects = true,
  bombPreview = null,
}: {
  state: GameState;
  flip: boolean;
  highlights: Set<number>;
  selected: number | null;
  onSquare: (i: number) => void;
  effects?: boolean;
  bombPreview?: { center: number; targets: number[] } | null;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shake, setShake] = useState(0);
  const lastFx = useRef<number | undefined>(state.fx?.id);
  const marble = useMarbleTexture();
  const checkSquare = isKingThreatened(state)
    ? state.board.findIndex((p) => p?.t === "k" && p.c === state.turn)
    : -1;

  useEffect(() => {
    const fx = state.fx;
    if (!fx || fx.id === lastFx.current) return;
    lastFx.current = fx.id;
    if (fx.kind === "move") return;
    const b = { ...fx, born: Date.now() };
    setBursts((x) => [...x, b]);
    if (["capture", "bomb", "bolt"].includes(fx.kind)) setShake(Date.now());
  }, [state.fx]);

  useEffect(() => {
    if (!bursts.length) return;
    const timeout = setTimeout(
      () => setBursts((items) => items.filter((b) => Date.now() - b.born < 2000)),
      2100,
    );
    return () => clearTimeout(timeout);
  }, [bursts]);

  // stable keys: track piece identity by following moves
  const pieces = state.board.map((p, i) => (p ? { p, i } : null)).filter(Boolean) as {
    p: NonNullable<GameState["board"][number]>;
    i: number;
  }[];
  const keyed = useStableKeys(state);
  const danger = new Set((state.bombs ?? []).flatMap((bomb) => bombArea(bomb.center)));
  const marked = new Set(
    (state.bombs ?? []).flatMap((bomb) =>
      bomb.targets.map((target) => state.board.findIndex((piece) => piece?.id === target.id)),
    ),
  );
  const preview = new Set(bombPreview ? bombArea(bombPreview.center) : []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 9, flip ? -10 : 10], fov: 38 }}
    >
      <ArenaCamera flip={flip} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 10, 4]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-normalBias={0.03}
      />
      <pointLight position={[0, 3, flip ? -6 : 6]} intensity={12} color={neon("w")} distance={14} />
      <pointLight position={[0, 3, flip ? 6 : -6]} intensity={12} color={neon("b")} distance={14} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer
          intensity={3}
          color={neon("w")}
          position={[-5, 1, 0]}
          rotation-y={Math.PI / 2}
          scale={[20, 1, 1]}
        />
        <Lightformer
          intensity={3}
          color={neon("b")}
          position={[5, 1, 0]}
          rotation-y={-Math.PI / 2}
          scale={[20, 1, 1]}
        />
      </Environment>

      {effects && (
        <Sparkles
          count={18}
          scale={[11, 2, 11]}
          position={[0, 1.8, 0]}
          size={1.1}
          color={token("white")}
          speed={0.25}
        />
      )}

      {/* Architectural gold and neon frame, open to the arena behind it. */}
      <mesh position={[0, -0.31, 0]} receiveShadow>
        <boxGeometry args={[9.2, 0.55, 9.2]} />
        <meshStandardMaterial color={token("base")} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.58, 0]} receiveShadow>
        <boxGeometry args={[9.55, 0.16, 9.55]} />
        <meshStandardMaterial color={token("base")} metalness={0.9} roughness={0.24} />
      </mesh>
      <BeveledFrame />
      {[-1, 1].map((side) => (
        <group key={`inlays-${side}`}>
          {Array.from({ length: 8 }, (_, i) => (
            <group key={i}>
              <mesh position={[side * 4.42, 0.005, i - 3.5]}>
                <boxGeometry args={[0.07, 0.035, 0.44]} />
                <meshStandardMaterial color={token("gold")} metalness={1} roughness={0.2} />
              </mesh>
              <mesh position={[i - 3.5, 0.005, side * 4.42]}>
                <boxGeometry args={[0.44, 0.035, 0.07]} />
                <meshStandardMaterial color={token("gold")} metalness={1} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {[4.12, 4.32, 4.55].map((edge, j) => (
        <group key={edge}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * edge, -0.05 - j * 0.07, 0]}>
                <boxGeometry args={[j === 1 ? 0.16 : 0.07, 0.16, edge * 2]} />
                <meshStandardMaterial
                  color={token(j === 1 ? "gold" : "cyan")}
                  emissive={token(j === 1 ? "gold" : "cyan")}
                  emissiveIntensity={j === 1 ? 0.5 : 0.75}
                  metalness={0.85}
                  roughness={0.18}
                />
              </mesh>
              <mesh position={[0, -0.05 - j * 0.07, side * edge]}>
                <boxGeometry args={[edge * 2, 0.16, j === 1 ? 0.16 : 0.07]} />
                <meshStandardMaterial
                  color={token(j === 1 ? "gold" : side === 1 ? "cyan" : "magenta")}
                  emissive={token(j === 1 ? "gold" : side === 1 ? "cyan" : "magenta")}
                  emissiveIntensity={j === 1 ? 0.5 : 0.75}
                  metalness={0.85}
                  roughness={0.18}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x * 4.4, 0.02, z * 4.4]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <boxGeometry args={[0.37, 0.22, 0.37]} />
            <meshStandardMaterial
              color={token("gold")}
              emissive={token("gold")}
              emissiveIntensity={0.45}
              metalness={1}
              roughness={0.18}
            />
          </mesh>
        )),
      )}
      <mesh position={[0, -0.22, 4.63]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.48, 0.48, 0.18]} />
        <meshStandardMaterial
          color={token("gold")}
          emissive={token("gold")}
          emissiveIntensity={0.5}
          metalness={0.8}
        />
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
              onClick={(e) => {
                e.stopPropagation();
                onSquare(i);
              }}
              onPointerOver={() => (document.body.style.cursor = "pointer")}
              onPointerOut={() => (document.body.style.cursor = "")}
            >
              <boxGeometry args={[0.98, 0.1, 0.98]} />
              <meshPhysicalMaterial
                color={dark ? token("dark") : token("light")}
                map={marble}
                bumpMap={marble}
                bumpScale={0.015}
                metalness={0.35}
                roughness={0.25}
                clearcoat={0.8}
                clearcoatRoughness={0.14}
                emissive={sel ? token("selection") : isLast ? token("amber") : token("black")}
                emissiveIntensity={sel ? 0.8 : isLast ? 0.25 : 0}
              />
            </mesh>
            {hl && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                {state.board[i] ? (
                  <ringGeometry args={[0.38, 0.47, 32]} />
                ) : (
                  <circleGeometry args={[0.14, 24]} />
                )}
                <meshBasicMaterial
                  color={state.board[i] ? token("target") : token("selection")}
                  toneMapped={false}
                />
              </mesh>
            )}
            {(danger.has(i) || preview.has(i)) && (
              <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.93, 0.93]} />
                <meshBasicMaterial
                  color={token("blast")}
                  transparent
                  opacity={danger.has(i) ? 0.22 : 0.13}
                  toneMapped={false}
                  depthWrite={false}
                />
              </mesh>
            )}
            {(marked.has(i) || bombPreview?.targets.includes(i)) && (
              <mesh position={[0, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.39, 0.48, 32]} />
                <meshBasicMaterial
                  color={token(danger.has(i) || preview.has(i) ? "blast" : "shield")}
                  toneMapped={false}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {pieces.map(({ p, i }) => (
        <group
          key={`${state.matchId ?? "legacy"}:${p.id ?? keyed[i] ?? i}`}
          name={`piece-${p.id ?? keyed[i] ?? i}`}
          onClick={(e) => {
            e.stopPropagation();
            onSquare(i);
          }}
        >
          <AnimatedPiece sq={i} kind={state.fx?.kind} type={p.t} animate={effects}>
            <group rotation={[0, p.c === "w" ? Math.PI : 0, 0]}>
              <PieceMesh
                t={p.t}
                c={p.c}
                frozen={isFrozen(p, state.move)}
                shielded={isShielded(p, state.move)}
              />
            </group>
          </AnimatedPiece>
        </group>
      ))}

      {effects && <Effects bursts={bursts} />}
      {checkSquare >= 0 && <CheckRing sq={checkSquare} />}
      {effects && <CameraShake trigger={shake} />}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.5}
        maxPolarAngle={1.1}
        minAzimuthAngle={-0.35 + (flip ? Math.PI : 0)}
        maxAzimuthAngle={0.35 + (flip ? Math.PI : 0)}
        target={[0, 0.4, 0]}
      />
      <EffectComposer>
        <Bloom
          intensity={effects ? 0.32 : 0.08}
          luminanceThreshold={0.95}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}

function ArenaCamera({ flip }: { flip: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    // Fit the near corners and tall pieces too, especially on a narrow phone.
    const bounds: THREE.Vector3[] = [];
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        bounds.push(new THREE.Vector3(x * 4.8, -0.6, z * 4.8));
        bounds.push(new THREE.Vector3(x * 3.9, 2.1, z * 3.9));
      }
    camera.updateProjectionMatrix();
    let distance = 10;
    for (let step = 0; step < 80; step++) {
      camera.position.set(0, distance * 0.66 + 0.4, (flip ? -1 : 1) * distance * 0.75);
      camera.lookAt(0, 0.4, 0);
      camera.updateMatrixWorld();
      const fits = bounds.every((point) => {
        const projected = point.clone().project(camera);
        return Math.abs(projected.x) <= 0.95 && Math.abs(projected.y) <= 0.95;
      });
      if (fits) break;
      distance *= 1.03;
    }
  }, [camera, size.width, size.height, flip]);
  return null;
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
      const key = prev.keys[i];
      if (p && q && q.c === p.c && q.t === p.t && key) {
        keys[i] = key;
        used.add(key);
      }
    });
    // moved pieces: match vanished ones of same color
    state.board.forEach((p, i) => {
      if (!p || keys[i]) return;
      const from = prev.board.findIndex(
        (q, j) =>
          q &&
          q.c === p.c &&
          (q.t === p.t || q.t === "p") &&
          prev.keys[j] &&
          !used.has(prev.keys[j] ?? "") &&
          !state.board[j],
      );
      const k = (from >= 0 ? prev.keys[from] : null) ?? `n${i}-${Date.now()}`;
      keys[i] = k;
      used.add(k);
    });
    ref.current = { keys, board: state.board };
  }
  return ref.current.keys;
}
