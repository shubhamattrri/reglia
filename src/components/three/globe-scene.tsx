"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Sphere } from "@react-three/drei";
import * as THREE from "three";
import { networkNodes } from "@/lib/site-config";

function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

type GlobeSceneProps = {
  progress?: number;
};

export function GlobeScene({ progress = 0 }: GlobeSceneProps) {
  const group = useRef<THREE.Group>(null);
  const radius = 1.65;

  const points = useMemo(
    () => networkNodes.map((n) => latLonToVec3(n.lat, n.lon, radius)),
    []
  );

  const arcs = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 3) % points.length];
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(radius * 1.35);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      lines.push(curve.getPoints(28));
    }
    return lines;
  }, [points]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (0.08 + progress * 0.12);
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      0.25 + progress * 0.15,
      0.05
    );
    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      progress * 1.2,
      0.05
    );
  });

  const visibleArcs = Math.floor(progress * arcs.length);

  return (
    <group ref={group}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 2, 3]} intensity={1.1} color="#fff1d6" />
      <pointLight position={[-3, -1, 2]} intensity={0.6} color="#6b7cff" />

      <Sphere args={[radius, 64, 64]}>
        <meshStandardMaterial
          color="#0a1220"
          metalness={0.55}
          roughness={0.45}
          emissive="#071018"
          emissiveIntensity={0.4}
        />
      </Sphere>

      <Sphere args={[radius * 1.02, 48, 48]}>
        <meshBasicMaterial
          color="#c4a574"
          wireframe
          transparent
          opacity={0.08 + progress * 0.08}
        />
      </Sphere>

      {points.map((p, i) => (
        <mesh key={networkNodes[i].id} position={p}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial
            color="#f0d9a8"
            transparent
            opacity={0.35 + progress * 0.65}
          />
        </mesh>
      ))}

      {arcs.slice(0, Math.max(1, visibleArcs)).map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#c4a574"
          lineWidth={1}
          transparent
          opacity={0.25 + progress * 0.45}
        />
      ))}
    </group>
  );
}
