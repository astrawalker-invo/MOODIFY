import { memo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group, InstancedMesh, Object3D } from "three";
import type { RainState } from "./sensors";
const transform = new Object3D();
const positions = Array.from({ length: 64 }, (_, i) => ({
  x: Math.sin(i * 17.3) * 1.9,
  z: Math.cos(i * 7.9) * 0.75,
  offset: (i * 0.61803398875) % 1,
}));
function Drops() {
  const mesh = useRef<InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    positions.forEach((p, i) => {
      transform.position.set(p.x, 0.5 - ((t * 0.42 + p.offset) % 1) * 3.2, p.z);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 64]}>
      <cylinderGeometry args={[0.009, 0.015, 0.19, 4]} />
      <meshBasicMaterial color="#7dd3fc" transparent opacity={0.7} />
    </instancedMesh>
  );
}
function Cloud({ wet, animate }: { wet: boolean; animate: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current && animate)
      group.current.position.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.035;
  });
  const spheres: [number, number, number, number][] = [
    [-1.1, 0.85, 0, 0.6],
    [-0.35, 1.2, 0, 0.85],
    [0.5, 1.05, 0, 0.78],
    [1.2, 0.8, 0, 0.55],
    [0, 0.6, 0.15, 0.85],
  ];
  return (
    <group ref={group}>
      {spheres.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, r * 0.76, r * 0.65]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial
            color={wet ? "#475569" : "#cbd5e1"}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}
export default memo(function RainScene({
  state,
  animate,
  onFailure,
}: {
  state: RainState;
  animate: boolean;
  onFailure: () => void;
}) {
  const wet = state === "wet";
  return (
    <Canvas
      camera={{ position: [0, 0.35, 6], fov: 42 }}
      dpr={[1, 1.5]}
      frameloop={animate && wet ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onFailure();
          },
          { once: true },
        );
      }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[-3, 5, 4]} intensity={2} />
      <Cloud wet={wet} animate={animate && wet} />
      {wet && animate && <Drops />}
    </Canvas>
  );
});
